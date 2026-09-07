import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const maxDuration = 60;

interface GiocatoreMappato {
  nome: string;
  squadra: string;
}

export async function GET() {
  try {
    const url = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 8000,
    });

    const $ = cheerio.load(html);
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    // Estrazione dai blocchi squadra di Fantacalcio.it
    $('[class*="team"]').each((_, teamBlock) => {
      const squadra = $(teamBlock)
        .find('h3, h4, .title, .team-name, .name')
        .first()
        .text()
        .trim()
        .toUpperCase();

      if (!squadra || squadra.length < 3) return;

      // Cerchiamo gli elementi specifici del nome giocatore
      $(teamBlock).find('.player-name, .name, [class*="player"]').each((_, p) => {
        let testoGrezzo = $(p).text() || '';

        // Prendiamo solo la prima riga se ci sono a capo e puliamo il testo
        let nomePulito = testoGrezzo
          .split('\n')[0]
          .replace(/^[PDCAR]\s+/i, '') // Rimuove ruoli come P, D, C, A
          .replace(/\d+%/g, '')         // Rimuove percentuali tipo 100%
          .replace(/[\n\r\t]+/g, '')   // Rimuove spazi vuoti strani e a capo
          .trim();

        // Evitiamo stringhe troppo corte, numeri o parole chiave non valide
        if (
          nomePulito &&
          nomePulito.length > 2 &&
          !nomePulito.includes('VS') &&
          isNaN(Number(nomePulito))
        ) {
          const chiaveUnica = `${nomePulito}-${squadra}`;
          if (!visti.has(chiaveUnica)) {
            visti.add(chiaveUnica);
            giocatoriMappati.push({ nome: nomePulito, squadra });
          }
        }
      });
    });

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile estrarre le formazioni.',
      });
    }

    // 1. Salvataggio / Upsert Squadre
    const squadreUniche = Array.from(new Set(giocatoriMappati.map((g) => g.squadra)));
    const { data: squadreDb } = await supabase
      .from('squadre')
      .upsert(squadreUniche.map((nome) => ({ nome })), { onConflict: 'nome' })
      .select('id, nome');

    const squadraMap = new Map(squadreDb?.map((s) => [s.nome, s.id]));

    // 2. Prepariamo e puliamo i giocatori da inserire su Supabase
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

    if (giocatoriDb && giocatoriDb.length > 0) {
      // 3. Upsert tabelle probabili formazioni
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
      message: 'Sincronizzazione pulita completata!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 15),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}