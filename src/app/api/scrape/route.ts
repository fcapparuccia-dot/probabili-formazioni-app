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
        'Accept-Language': 'it-IT,it;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(html);
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    // Selettore principale delle schede incontro su Fantacalcio.it
    $('.box-card, .card, [class*="match"]').each((_, card) => {
      // Individua i blocchi relativi alle due squadre nella scheda
      $(card).find('.box-legenda, .team-incart, [class*="team"]').each((_, teamBlock) => {
        // Estrai il nome della squadra
        let squadra = $(teamBlock)
          .find('.team-name, .squadra-nome, h3, h4, header, .title')
          .first()
          .text()
          .trim()
          .toUpperCase();

        if (!squadra || squadra.length < 3) return;

        // Estrai tutti gli elementi giocatore dentro la singola squadra
        $(teamBlock).find('.player-item, .player-name, .titola-item, [class*="player"]').each((_, p) => {
          let rawText = $(p).text() || '';

          // Pulizia mirata: estrae solo il nome prima di a capo, percentuali o ruoli
          let nomePulito = rawText
            .split('\n')[0]
            .replace(/^[PDCAR]\s+/i, '')
            .replace(/\d+%/g, '')
            .replace(/[\n\r\t]+/g, '')
            .trim();

          // Ignora stringhe non valide, percentuali o duplicati
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
    });

    // Fallback ad ampio spettro se la struttura del wrapper varia
    if (giocatoriMappati.length === 0) {
      $('[class*="team"]').each((_, teamBlock) => {
        const squadra = $(teamBlock)
          .find('h3, h4, .title, .team-name, header')
          .first()
          .text()
          .trim()
          .toUpperCase();

        if (!squadra || squadra.length < 3) return;

        $(teamBlock).find('a, span, div').each((_, el) => {
          const txt = $(el).text().trim();
          // Individua nodi di testo legati ai calciatori
          if ($(el).children().length === 0 && txt.length > 2 && !txt.includes('%') && !txt.includes('VS')) {
            const nomeClean = txt.replace(/^[PDCAR]\s+/i, '').trim();
            if (nomeClean.length > 2 && isNaN(Number(nomeClean))) {
              const key = `${nomeClean}-${squadra}`;
              if (!visti.has(key)) {
                visti.add(key);
                giocatoriMappati.push({ nome: nomeClean, squadra });
              }
            }
          }
        });
      });
    }

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile estrarre le formazioni. Verificare selettori.',
      });
    }

    // 1. Bulk Upsert delle Squadre
    const squadreUniche = Array.from(new Set(giocatoriMappati.map((g) => g.squadra)));
    const { data: squadreDb } = await supabase
      .from('squadre')
      .upsert(squadreUniche.map((nome) => ({ nome })), { onConflict: 'nome' })
      .select('id, nome');

    const squadraMap = new Map(squadreDb?.map((s) => [s.nome, s.id]));

    // 2. Bulk Upsert dei Giocatori
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

    // 3. Bulk Upsert delle Probabili Formazioni
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