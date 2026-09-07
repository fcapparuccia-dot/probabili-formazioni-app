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

// Termini del menu, footer e navigazione da scartare tassativamente
const TERMINI_MENU_O_NAVIGATION = [
  'PROBABILI FORMAZIONI', 'SERIE A', 'CALCIOMERCATO', 'NOTIZIE', 'NEWS',
  'FANTACALCIO', 'CONTATTI', 'PRIVACY', 'COOKIE', 'GUIDA', 'SEGUI',
  'ULTIME NEWS', 'LISTONE', 'VOTI', 'CLASSIFICA', 'CALENDARIO', 'STATISTICHE',
  'CONFIGURATORE', 'EUROLEGHE', 'REGOLAMENTO', 'SUPPORT', 'LOGIN', 'REGISTER'
];

export async function GET() {
  try {
    const url = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(html);
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    // Rimuoviamo header, nav, footer e barre laterali per escludere il menu a monte
    $('header, footer, nav, .menu, .sidebar, .nav-wrapper').remove();

    // Lavoriamo solo sul corpo principale con le schede delle partite
    $('main, .content, .main-content, body').find('*').each((_, el) => {
      const text = $(el).text().trim();

      // Consideriamo solo nodi foglia (senza figli) con lunghezza idonea per un nome di calciatore
      if ($(el).children().length === 0 && text.length >= 3 && text.length <= 28) {
        const textUpper = text.toUpperCase();

        // Verifica se si tratta di un termine di navigazione/menu
        const eMenu = TERMINI_MENU_O_NAVIGATION.some((term) => textUpper.includes(term));
        if (eMenu) return;

        // Risale per identificare la squadra di appartenenza
        const parentContext = $(el).closest('article, .card, div').text().toUpperCase();
        const squadraTrovata = SQUADRE_SERIE_A.find((s) => parentContext.includes(s));

        if (squadraTrovata) {
          let nomePulito = text
            .split('\n')[0]
            .replace(/^[PDCAR]\s+/i, '')
            .replace(/\d+%/g, '')
            .replace(/[\n\r\t]+/g, '')
            .trim();

          const nomeUpper = nomePulito.toUpperCase();

          if (
            nomePulito.length >= 3 &&
            !nomePulito.includes('VS') &&
            !/^\d[-\d]+\d$/.test(nomePulito) &&
            !SQUADRE_SERIE_A.includes(nomeUpper) &&
            isNaN(Number(nomePulito))
          ) {
            const key = `${nomePulito}-${squadraTrovata}`;
            if (!visti.has(key)) {
              visti.add(key);
              giocatoriMappati.push({ nome: nomePulito, squadra: squadraTrovata });
            }
          }
        }
      }
    });

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Nessun giocatore estratto dopo il filtraggio del menu.',
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