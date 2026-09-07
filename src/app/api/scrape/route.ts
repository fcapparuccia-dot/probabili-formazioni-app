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

const PAROLE_DA_ESCLUDERE = [
  'PROBABILI', 'FORMAZIONI', 'SERIE', 'CALCIOMERCATO', 'NEWS', 'FANTACALCIO',
  'NOTIZIE', 'ULTIME', 'VOTI', 'CLASSIFICA', 'CALENDARIO', 'GUIDA', 'ASTA',
  'BALLOTTAGGIO', 'INFORTUNATI', 'SQUALIFICATI', 'PANCHINA', 'SQUADRA'
];

export async function GET() {
  try {
    const url = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
      timeout: 12000,
    });

    const $ = cheerio.load(html);
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    $('header, footer, nav, .menu, .sidebar, .breadcrumbs, .banner, .ad-box').remove();

    // Individua ogni singolo blocco/colonna riservato a UNA SOLA SQUADRA
    $('[class*="team"], [class*="squadra"], .box-legenda, .team-incart, .card-team').each((_, teamBlock) => {
      // Estrae il nome della squadra direttamente dall'intestazione del blocco
      const headerText = $(teamBlock)
        .find('h3, h4, .team-name, .squadra-nome, .title, header, strong')
        .first()
        .text()
        .toUpperCase()
        .trim();

      const squadraUfficiale = SQUADRE_SERIE_A.find((s) => headerText.includes(s));
      if (!squadraUfficiale) return;

      // Estrae tutti i giocatori presenti SOLO all'interno di questa colonna squadra
      $(teamBlock).find('a, .player-name, .player-item, [class*="player"], li').each((_, p) => {
        // Ignora elementi che contengono altri sotto-elementi
        if ($(p).children().length > 1) return;

        const rawText = $(p).text() || '';

        let nomePulito = rawText
          .split('\n')[0]
          .replace(/^[PDCAR]\s+/i, '')
          .replace(/\d+%/g, '')
          .replace(/[\n\r\t]+/g, ' ')
          .trim();

        const nomeUpper = nomePulito.toUpperCase();
        const contieneEsclusioni = PAROLE_DA_ESCLUDERE.some((term) => nomeUpper.includes(term));

        if (
          nomePulito.length >= 3 &&
          nomePulito.length <= 25 &&
          !contieneEsclusioni &&
          !nomePulito.includes('VS') &&
          !/^\d[-\d]+\d$/.test(nomePulito) &&
          !SQUADRE_SERIE_A.includes(nomeUpper) &&
          isNaN(Number(nomePulito))
        ) {
          const chiaveUnica = `${nomePulito}-${squadraUfficiale}`;
          if (!visti.has(chiaveUnica)) {
            visti.add(chiaveUnica);
            giocatoriMappati.push({ nome: nomePulito, squadra: squadraUfficiale });
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

    // 1. Bulk Upsert Squadre
    const squadreUniche = Array.from(new Set(giocatoriMappati.map((g) => g.squadra)));
    const { data: squadreDb } = await supabase
      .from('squadre')
      .upsert(squadreUniche.map((nome) => ({ nome })), { onConflict: 'nome' })
      .select('id, nome');

    const squadraMap = new Map(squadreDb?.map((s) => [s.nome, s.id]));

    // 2. Bulk Upsert Giocatori
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

    // 3. Bulk Upsert Probabili Formazioni
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
      message: 'Sincronizzazione completata e pulita!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 15),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}