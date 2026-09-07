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
    const url = 'https://www.sportmediaset.mediaset.it/calcissimo/probabili-formazioni-serie-a/';
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
      timeout: 12000,
    });

    const $ = cheerio.load(html);
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    // Sportmediaset divide i blocchi delle partite in modo chiaro
    $('.block-match, .box-match, article, .row-match, .match-container').each((_, matchBlock) => {
      // Per ogni partita, trova le due sezioni delle rispettive squadre
      $(matchBlock).find('.team, .squadra, .col-team, [class*="team"]').each((_, teamBlock) => {
        const teamNameRaw = $(teamBlock).find('.team-name, h3, h4, strong, .title').first().text().toUpperCase().trim();
        const squadraTrovata = SQUADRE_SERIE_A.find((s) => teamNameRaw.includes(s));

        if (!squadraTrovata) return;

        // Estrae i singoli calciatori dal blocco squadra isolato
        $(teamBlock).find('.player, .giocatore, li, p').each((_, playerEl) => {
          const text = $(playerEl).text().trim();
          if (!text || text.length < 3 || text.length > 25) return;

          let nomePulito = text
            .split('\n')[0]
            .replace(/^[PDCAR]\s+/i, '')
            .replace(/\d+%/g, '')
            .replace(/[\n\r\t]+/g, ' ')
            .trim();

          const nomeUpper = nomePulito.toUpperCase();

          if (
            nomePulito.length >= 3 &&
            !SQUADRE_SERIE_A.includes(nomeUpper) &&
            !/PROBABILI|FORMAZIONI|SQUALIFICATI|INFORTUNATI|BALLOTTAGGI/i.test(nomeUpper) &&
            nomePulito.split(' ').length <= 3
          ) {
            const key = `${nomePulito}-${squadraTrovata}`;
            if (!visti.has(key)) {
              visti.add(key);
              giocatoriMappati.push({ nome: nomePulito, squadra: squadraTrovata });
            }
          }
        });
      });
    });

    // Fallback: se la struttura specifica del CSS cambia, parsing sequenziale su liste
    if (giocatoriMappati.length === 0) {
      let squadraCorrente = '';

      $('main, .content, body').find('h2, h3, h4, .squadra, li, p').each((_, el) => {
        const text = $(el).text().trim();
        if (!text) return;

        const textUpper = text.toUpperCase();
        const squadraTrovata = SQUADRE_SERIE_A.find((s) => textUpper === s || textUpper.startsWith(s + ' '));

        if (squadraTrovata) {
          squadraCorrente = squadraTrovata;
          return;
        }

        if (squadraCorrente && text.length >= 3 && text.length <= 25) {
          const nomeUpper = text.toUpperCase();
          if (
            !SQUADRE_SERIE_A.includes(nomeUpper) &&
            !/PROBABILI|FORMAZIONI|SQUALIFICATI|INFORTUNATI/i.test(nomeUpper) &&
            text.split(' ').length <= 3
          ) {
            const key = `${text}-${squadraCorrente}`;
            if (!visti.has(key)) {
              visti.add(key);
              giocatoriMappati.push({ nome: text, squadra: squadraCorrente });
            }
          }
        }
      });
    }

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile estrarre i dati dalla nuova fonte.',
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
        fonte: 'Sportmediaset',
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
      message: 'Sincronizzazione completata da Sportmediaset!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 15),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}