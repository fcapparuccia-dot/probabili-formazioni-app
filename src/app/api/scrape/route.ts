import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const maxDuration = 60;

interface GiocatoreMappato {
  nome: string;
  squadra: string;
}

const SQUADRE_SERIE_A = [
  'ATALANTA', 'BOLOGNA', 'CAGLIARI', 'COMO', 'EMPOLI', 'FIORENTINA',
  'GENOA', 'INTER', 'JUVENTUS', 'LAZIO', 'LECCE', 'MILAN', 'MONZA',
  'NAPOLI', 'PARMA', 'ROMA', 'TORINO', 'UDINESE', 'VENEZIA', 'VERONA', 'SASSUOLO'
];

export async function GET() {
  try {
    const url = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(html);
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    // 1. Scansioniamo tutti gli elementi che contengono il testo di una squadra di Serie A
    $('h1, h2, h3, h4, h5, div, span, a, p').each((_, el) => {
      const testoNodo = $(el).text().trim().toUpperCase();

      // Verifica se il testo corrisponde esattamente a una delle squadre
      const squadraTrovata = SQUADRE_SERIE_A.find(
        (s) => testoNodo === s || testoNodo.startsWith(s + ' ') || testoNodo.endsWith(' ' + s)
      );

      if (!squadraTrovata) return;

      // Risaliamo al primo contenitore comune (es. la card della partita o della singola squadra)
      const parentCard = $(el).closest('.card, .box-card, [class*="match"], [class*="team"], div');

      if (parentCard.length > 0) {
        // Estraiamo tutti i nodi di testo interni
        parentCard.find('a, span, div, li, p').each((_, playerNode) => {
          // Prendiamo solo i nodi foglia (senza figli) per evitare duplicati
          if ($(playerNode).children().length === 0) {
            const rawText = $(playerNode).text().trim();

            let nomePulito = rawText
              .split('\n')[0]
              .replace(/^[PDCAR]\s+/i, '')
              .replace(/\d+%/g, '')
              .replace(/[\n\r\t]+/g, '')
              .trim();

            if (
              nomePulito &&
              nomePulito.length > 2 &&
              !nomePulito.includes('VS') &&
              !/^\d[-\d]+\d$/.test(nomePulito) &&
              !SQUADRE_SERIE_A.includes(nomePulito.toUpperCase()) &&
              isNaN(Number(nomePulito))
            ) {
              const chiaveUnica = `${nomePulito}-${squadraTrovata}`;
              if (!visti.has(chiaveUnica)) {
                visti.add(chiaveUnica);
                giocatoriMappati.push({ nome: nomePulito, squadra: squadraTrovata });
              }
            }
          }
        });
      }
    });

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile estrarre le formazioni. Nessun abbinamento trovato.',
      });
    }

    // 2. Bulk Upsert delle Squadre
    const squadreUniche = Array.from(new Set(giocatoriMappati.map((g) => g.squadra)));
    const { data: squadreDb } = await supabase
      .from('squadre')
      .upsert(squadreUniche.map((nome) => ({ nome })), { onConflict: 'nome' })
      .select('id, nome');

    const squadraMap = new Map(squadreDb?.map((s) => [s.nome, s.id]));

    // 3. Bulk Upsert dei Giocatori
    const giocatoriDaInserire = giocatoriMappati
      .filter((g) => squadraMap.has(g.squadra))
      .map((g) => ({
        nome_completo: g.nome,
        squadra_id: squadraMap.get(g.squadra)!,
      }));

    const { data: giocatoriDb } = await supabase
      .from('giocatori')
      .upsert(giocatoriDaInserire, { onConflict: 'nome_completo' })
      .select('id');

    // 4. Bulk Upsert delle Probabili Formazioni
    if (giocatoriDb && giocatoriDb.length > 0) {
      const formazioniData = giocatoriDb.map((g) => ({
        giocatore_id: g.id,
        fonte: 'Fantacalcio.it',
        percentuale_titolarita: 100,
        stato: 'titolare',
        aggiornato_il: new Date().toISOString(),
      }));

      await supabase
        .from('probabili_formazioni')
        .upsert(formazioniData, { onConflict: 'giocatore_id,fonte' });
    }

    return NextResponse.json({
      success: true,
      message: 'Sincronizzazione completata con successo!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}