import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import * as cheerio from 'cheerio';

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
    });

    const $ = cheerio.load(html);
    const giocatoriMappati: GiocatoreMappato[] = [];

    // Scorriamo ogni singola partita/scheda del match
    $('.match-card, .card-match, .box-partita').each((_, matchElement) => {
      // Per ogni partita troviamo i due blocchi casa e trasferta
      $(matchElement)
        .find('.team-card, .box-squadra')
        .each((_, teamElement) => {
          // Estragga il nome della squadra dal blocco specifico
          const nomeSquadra = $(teamElement)
            .find('.team-name, .squadra-nome')
            .text()
            .trim()
            .toUpperCase();

          if (!nomeSquadra) return;

          // Estragga SOLO i titolari contenuti DENTRO il blocco di questa squadra
          $(teamElement)
            .find('.player-name, .titola-item')
            .each((_, playerElement) => {
              const nomeGiocatore = $(playerElement).text().trim();

              if (nomeGiocatore && nomeGiocatore.length > 2) {
                giocatoriMappati.push({
                  nome: nomeGiocatore,
                  squadra: nomeSquadra,
                });
              }
            });
        });
    });

    // Se i selettori sopra non intercettano il layout esatto di Fantacalcio.it,
    // usiamo la struttura generica basata sulle sezioni delle squadre:
    if (giocatoriMappati.length === 0) {
      $('.card-squadra, .single-team').each((_, teamBlock) => {
        const squadra = $(teamBlock).find('h3, .title').text().trim().toUpperCase();
        $(teamBlock).find('.player, .giocatore').each((_, p) => {
          const nome = $(p).text().trim();
          if (squadra && nome) {
            giocatoriMappati.push({ nome, squadra });
          }
        });
      });
    }

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile estrarre le formazioni. Verificare i selettori HTML.',
      });
    }

    // Salvataggio su Supabase
    for (const item of giocatoriMappati) {
      let { data: squadraDb } = await supabase
        .from('squadre')
        .select('id')
        .eq('nome', item.squadra)
        .maybeSingle();

      if (!squadraDb) {
        const { data: newSquadra } = await supabase
          .from('squadre')
          .insert({ nome: item.squadra })
          .select('id')
          .single();
        squadraDb = newSquadra;
      }

      if (squadraDb) {
        let { data: giocatoreDb } = await supabase
          .from('giocatori')
          .select('id')
          .eq('nome_completo', item.nome)
          .maybeSingle();

        if (!giocatoreDb) {
          const { data: newGiocatore } = await supabase
            .from('giocatori')
            .insert({
              nome_completo: item.nome,
              squadra_id: squadraDb.id,
            })
            .select('id')
            .single();
          giocatoreDb = newGiocatore;
        } else {
          // Aggiorna la squadra del giocatore se era errata nel DB
          await supabase
            .from('giocatori')
            .update({ squadra_id: squadraDb.id })
            .eq('id', giocatoreDb.id);
        }

        if (giocatoreDb) {
          await supabase.from('probabili_formazioni').upsert(
            {
              giocatore_id: giocatoreDb.id,
              fonte: 'Fantacalcio.it',
              percentuale_titolarita: 100,
              stato: 'titolare',
              aggiornato_il: new Date().toISOString(),
            },
            { onConflict: 'giocatore_id,fonte' }
          );
        }
      }
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