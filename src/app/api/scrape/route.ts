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

    // Ogni partita è contenuta in un blocco con classe .card
    $('.card').each((_, matchElement) => {
      // Troviamo i blocchi squadra (casa e trasferta)
      $(matchElement).find('.team').each((_, teamElement) => {
        // Estragga il nome della squadra dal titolo del blocco
        const nomeSquadra = $(teamElement)
          .find('.team-name, .name, h3, header')
          .first()
          .text()
          .trim()
          .toUpperCase();

        if (!nomeSquadra) return;

        // Estragga i giocatori titolari presenti all'interno della singola squadra
        $(teamElement).find('.player-item, .player, .titolarity-item').each((_, playerElement) => {
          const nomeGiocatore = $(playerElement).find('.player-name, .name').text().trim() || $(playerElement).text().trim();

          // Pulizia del testo da ruoli o numeri
          const nomePulito = nomeGiocatore.replace(/^[PDCAR]\s+/i, '').replace(/\d+/g, '').trim();

          if (nomePulito && nomePulito.length > 2) {
            giocatoriMappati.push({
              nome: nomePulito,
              squadra: nomeSquadra,
            });
          }
        });
      });
    });

    // Fallback: ricerca diretta su tutti i contenitori di squadra della pagina
    if (giocatoriMappati.length === 0) {
      $('[class*="team"]').each((_, teamBlock) => {
        const squadra = $(teamBlock).find('h3, h4, .title, .team-name').first().text().trim().toUpperCase();
        if (!squadra) return;

        $(teamBlock).find('[class*="player"]').each((_, p) => {
          const nome = $(p).text().trim().replace(/^[PDCAR]\s+/i, '').trim();
          if (nome && nome.length > 2 && !nome.includes('VS')) {
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
          // Ri-allinea la squadra nel DB se era precedentemente errata
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
      message: 'Sincronizzazione da Fantacalcio.it completata con successo!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}