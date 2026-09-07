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
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    // STRATEGIA 1: Tenta di scaricare tramite API/JSON di Fantacalcio o endpoint mobile
    try {
      const response = await axios.get('https://www.fantacalcio.it/api/v1/probabili-formazioni', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          'Accept': 'application/json, text/plain, */*',
        },
        timeout: 8000,
      });

      if (response.data && Array.isArray(response.data)) {
        for (const match of response.data) {
          const homeTeam = match.home_team_name?.toUpperCase() || '';
          const awayTeam = match.away_team_name?.toUpperCase() || '';

          if (match.home_lineup && Array.isArray(match.home_lineup)) {
            for (const p of match.home_lineup) {
              if (p.name && homeTeam) {
                const key = `${p.name}-${homeTeam}`;
                if (!visti.has(key)) {
                  visti.add(key);
                  giocatoriMappati.push({ nome: p.name, squadra: homeTeam });
                }
              }
            }
          }

          if (match.away_lineup && Array.isArray(match.away_lineup)) {
            for (const p of match.away_lineup) {
              if (p.name && awayTeam) {
                const key = `${p.name}-${awayTeam}`;
                if (!visti.has(key)) {
                  visti.add(key);
                  giocatoriMappati.push({ nome: p.name, squadra: awayTeam });
                }
              }
            }
          }
        }
      }
    } catch {
      // Se l'API diretta fallisce o richiede token, procede col fallback HTML esteso
    }

    // STRATEGIA 2: Fallback HTML con User-Agent di un browser reale desktop ed estrazione generica
    if (giocatoriMappati.length === 0) {
      const url = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
      const { data: html } = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(html);

      // Cerca qualsiasi blocco di testo contenente nomi di calciatori
      $('*').each((_, el) => {
        const text = $(el).text().trim();
        // Cerca pattern tipo nomi calciatori (es. "3-5-2", ruoli, o blocchi con link)
        if ($(el).children().length === 0 && text.length > 2 && text.length < 30) {
          const parentText = $(el).parent().parent().text().toUpperCase();
          const squadraTrovata = SQUADRE_SERIE_A.find((s) => parentText.includes(s));

          if (squadraTrovata) {
            let nomePulito = text
              .replace(/^[PDCAR]\s+/i, '')
              .replace(/\d+%/g, '')
              .trim();

            if (
              nomePulito.length >= 3 &&
              !nomePulito.includes('VS') &&
              !/^\d[-\d]+\d$/.test(nomePulito) &&
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
        }
      });
    }

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Blocco anti-bot o struttura HTML non accessibile da Vercel.',
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
      campione: giocatoriMappati.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}