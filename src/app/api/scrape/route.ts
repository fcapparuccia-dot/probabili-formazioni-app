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
  'BALLOTTAGGIO', 'INFORTUNATI', 'SQUALIFICATI', 'PANCHINA', 'SQUADRA',
  'CONTATTI', 'PRIVACY', 'COOKIE', 'REGOLAMENTO', 'SUPPORT', 'LOGIN', 'HOME'
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

    // Rimuoviamo elementi non di contenuto
    $('header, footer, nav, .menu, .sidebar, .breadcrumbs, .banner, .ad-box, script, style').remove();

    // STRATEGIA 1: Cerca le schede/card delle partite e separa le due squadre
    const matchCards = $('.card-match, .match-card, .box-partita, .card-team, article, section').toArray();

    for (const card of matchCards) {
      const cardEl = $(card);
      const cardTextUpper = cardEl.text().toUpperCase();

      // Trova quali squadre di Serie A sono citate nella card
      const squadreInCard = SQUADRE_SERIE_A.filter((sq) => cardTextUpper.includes(sq));
      if (squadreInCard.length === 0) continue;

      // Cerca i link o elementi di testo con nomi di calciatori (spesso con link /formazioni/ o classe player)
      cardEl.find('a, .player-name, .player, span, li').each((_, p) => {
        if ($(p).children().length > 0) return; // Solo nodi foglia

        const rawText = $(p).text().trim();
        if (!rawText || rawText.length < 3 || rawText.length > 25) return;

        let nomePulito = rawText
          .split('\n')[0]
          .replace(/^[PDCAR]\s+/i, '')
          .replace(/\d+%/g, '')
          .replace(/[\n\r\t]+/g, ' ')
          .trim();

        const nomeUpper = nomePulito.toUpperCase();
        const contieneEsclusioni = PAROLE_DA_ESCLUDERE.some((term) => nomeUpper.includes(term));

        if (
          !contieneEsclusioni &&
          !nomePulito.includes('VS') &&
          !/^\d+$/.test(nomePulito) &&
          !/^\d[-\d]+\d$/.test(nomePulito) &&
          !SQUADRE_SERIE_A.includes(nomeUpper) &&
          nomePulito.split(' ').length <= 3
        ) {
          // Determina a quale delle squadre della card appartiene il nodo risalendo i genitori
          let squadraAssegnata = squadreInCard[0]; // fallback prima squadra della card
          const parentText = $(p).closest('div, ul, table, section').text().toUpperCase();

          for (const sq of squadreInCard) {
            if (parentText.includes(sq)) {
              squadraAssegnata = sq;
              break;
            }
          }

          const chiaveUnica = `${nomePulito}-${squadraAssegnata}`;
          if (!visti.has(chiaveUnica)) {
            visti.add(chiaveUnica);
            giocatoriMappati.push({ nome: nomePulito, squadra: squadraAssegnata });
          }
        }
      });
    }

    // STRATEGIA 2: Fallback tramite scansione lineare se la strategia 1 non ha trovato abbastanza elementi
    if (giocatoriMappati.length < 50) {
      let squadraCorrente = '';

      $('main, body').find('h1, h2, h3, h4, h5, h6, a, span, p, div, li').each((_, el) => {
        if ($(el).children().length > 0) return;

        const text = $(el).text().trim();
        if (!text || text.length < 2) return;

        const textUpper = text.toUpperCase();

        // Se il testo corrisponde o contiene chiaramente il nome di una squadra di Serie A, aggiorna la squadra corrente
        const squadraTrovata = SQUADRE_SERIE_A.find((s) => textUpper === s || textUpper.startsWith(s + ' ') || textUpper.endsWith(' ' + s));
        if (squadraTrovata) {
          squadraCorrente = squadraTrovata;
          return;
        }

        if (!squadraCorrente) return;

        let nomePulito = text
          .split('\n')[0]
          .replace(/^[PDCAR]\s+/i, '')
          .replace(/\d+%/g, '')
          .trim();

        const nomeUpper = nomePulito.toUpperCase();
        const contieneEsclusioni = PAROLE_DA_ESCLUDERE.some((term) => nomeUpper.includes(term));

        if (
          nomePulito.length >= 3 &&
          nomePulito.length <= 25 &&
          !contieneEsclusioni &&
          !nomePulito.includes('VS') &&
          !SQUADRE_SERIE_A.includes(nomeUpper) &&
          !/^\d+$/.test(nomePulito) &&
          nomePulito.split(' ').length <= 3
        ) {
          const chiaveUnica = `${nomePulito}-${squadraCorrente}`;
          if (!visti.has(chiaveUnica)) {
            visti.add(chiaveUnica);
            giocatoriMappati.push({ nome: nomePulito, squadra: squadraCorrente });
          }
        }
      });
    }

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile estrarre le formazioni. Verificare la struttura della pagina.',
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
      message: 'Sincronizzazione completata con successo!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 15),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}