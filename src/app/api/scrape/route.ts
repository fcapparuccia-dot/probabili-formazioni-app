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
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 12000,
    });

    const $ = cheerio.load(html);
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    // Rimuoviamo header, footer, menu, widget e breadcrumb
    $('header, footer, nav, .menu, .sidebar, .breadcrumbs, .banner, .ad-box').remove();

    // 1. STRATEGIA SELETTORI SPECIFICI (Nomi giocatori all'interno dei box partita)
    // Cerca gli elementi specifici dei calciatori dentro le formazioni
    $('.player-name, .player, .player-item, a[href*="/squadre/"], a[href*="/giocatori/"], .titolarita-player, .player-row').each((_, el) => {
      const text = $(el).text().trim();
      
      if (!text || text.length < 3 || text.length > 30) return;

      // Risale fino al contenitore della partita o del blocco squadra
      const parentBlock = $(el).closest('.card-match, .match-card, .match, .box-partita, .single-match, article, section, div');
      const parentText = parentBlock.text().toUpperCase();

      const squadraTrovata = SQUADRE_SERIE_A.find((s) => parentText.includes(s));

      if (squadraTrovata) {
        let nomePulito = text
          .split('\n')[0]
          .replace(/^[PDCAR]\s+/i, '') // Rimuove eventuali lettere ruolo
          .replace(/\d+%/g, '')       // Rimuove percentuali di titolarità
          .replace(/[\n\r\t]+/g, ' ')
          .trim();

        // Controllo validità nome (esclude frasi lunghe o parole di navigazione)
        const parole = nomePulito.split(' ');
        const isFraseOHeader = parole.length > 4 || nomePulito.length > 25;
        const contieneParoleChiaveSito = /PROBABILI|FORMAZIONI|SERIE|CALCIOMERCATO|NEWS|FANTACALCIO|NOTIZIE|ULTIME|VOTI|CLASSIFICA|CALENDARIO|GUIDA|ASTA/i.test(nomePulito);

        if (
          nomePulito.length >= 3 &&
          !isFraseOHeader &&
          !contieneParoleChiaveSito &&
          !nomePulito.includes('VS') &&
          !SQUADRE_SERIE_A.includes(nomePulito.toUpperCase()) &&
          isNaN(Number(nomePulito))
        ) {
          const key = `${nomePulito}-${squadraTrovata}`;
          if (!visti.has(key)) {
            visti.add(key);
            giocatoriMappati.push({ nome: nomePulito, squadra: squadraTrovata });
          }
        }
      }
    });

    // 2. FALLBACK SELETTORI AMPI (Se i selettori specifici non trovano nulla)
    if (giocatoriMappati.length === 0) {
      $('main, .content, #main').find('a, span, p, div').each((_, el) => {
        if ($(el).children().length > 0) return; // solo nodi foglia

        const text = $(el).text().trim();
        if (!text || text.length < 3 || text.length > 25) return;

        const parentText = $(el).closest('article, .card, div').text().toUpperCase();
        const squadraTrovata = SQUADRE_SERIE_A.find((s) => parentText.includes(s));

        if (squadraTrovata) {
          const nomeUpper = text.toUpperCase();
          const contieneParoleSito = /PROBABILI|FORMAZIONI|SERIE|CALCIOMERCATO|NEWS|FANTACALCIO|NOTIZIE|ULTIME|VOTI|CLASSIFICA|CALENDARIO|GUIDA|ASTA|LOGIN|REGISTRATI/i.test(nomeUpper);

          if (!contieneParoleSito && text.split(' ').length <= 3 && !SQUADRE_SERIE_A.includes(nomeUpper)) {
            const key = `${text}-${squadraTrovata}`;
            if (!visti.has(key)) {
              visti.add(key);
              giocatoriMappati.push({ nome: text, squadra: squadraTrovata });
            }
          }
        }
      });
    }

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Nessun giocatore estrapolato. Verificare la struttura HTML della pagina.',
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
      const fornamzioniData = giocatoriDb.map((g) => ({
        giocatore_id: g.id,
        fonte: 'Fantacalcio.it',
        percentuale_titolarita: 100,
        stato: 'titolare',
        aggiornato_il: new Date().toISOString(),
      }));

      await supabase
        .from('probabili_formazioni')
        .upsert(fornamzioniData, { onConflict: 'giocatore_id,fonte' });
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