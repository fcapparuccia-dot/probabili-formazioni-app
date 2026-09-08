import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // 1. Scarica l'HTML della pagina delle probabili formazioni
    const response = await fetch('https://www.fantacalcio.it/probabili-formazioni-serie-a', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Errore durante il recupero della pagina: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 2. Estrazione dati con Cheerio (equivalente a BeautifulSoup)
    const datiFormazioni: {
      nomeGiocatore: string;
      ruolo: string;
      squadra: string;
      percentuale: number;
      stato: string;
    }[] = [];

    // Cicla sulle schede di ogni partita/squadra
    $('.card-match, .match-card').each((_, matchElement) => {
      // Estrai le due squadre della partita
      $(matchElement)
        .find('.team-name, .squadra-name')
        .each((squadraIdx, squadraElem) => {
          const nomeSquadra = $(squadraElem).text().trim().toUpperCase();

          // Trova il blocco dei titolari corrispondente
          const bloccoTitolari = $(matchElement).find('.titolari, .team-lineup').eq(squadraIdx);

          bloccoTitolari.find('.player-item, .giocatore').each((_, giocatoreElem) => {
            const nomeGiocatore = $(giocatoreElem).find('.player-name, .nome').text().trim();
            const ruolo = $(giocatoreElem).find('.player-role, .ruolo').text().trim() || 'N/D';
            
            // Estrai la percentuale di titolarità (es: "70%")
            const percText = $(giocatoreElem).find('.percentage, .percentuale').text().trim();
            const percentuale = parseInt(percText.replace('%', ''), 10) || 50;

            const stato = $(giocatoreElem).find('.status, .ballottaggio').text().trim() || 'Titolare';

            if (nomeGiocatore && nomeSquadra) {
              datiFormazioni.push({
                nomeGiocatore,
                ruolo,
                squadra: nomeSquadra,
                percentuale,
                stato,
              });
            }
          });
        });
    });

    // 3. Salva i dati recuperati su Supabase
    // Adatta i nomi delle tabelle/colonne alla struttura del tuo database
    if (datiFormazioni.length > 0) {
      // Svuota o aggiorna la tabella per contenere le formazioni aggiornate
      for (const item of datiFormazioni) {
        // Cerca o inserisci la squadra
        const { data: squadraData } = await supabase
          .from('squadre')
          .select('id')
          .eq('nome', item.squadra)
          .single();

        let squadraId = squadraData?.id;

        if (!squadraId) {
          const { data: nuovaSquadra } = await supabase
            .from('squadre')
            .insert({ nome: item.squadra })
            .select('id')
            .single();
          squadraId = nuovaSquadra?.id;
        }

        // Cerca o inserisci il giocatore
        const { data: giocatoreData } = await supabase
          .from('giocatori')
          .select('id')
          .eq('nome_completo', item.nomeGiocatore)
          .single();

        let giocatoreId = giocatoreData?.id;

        if (!giocatoreId) {
          const { data: nuovoGiocatore } = await supabase
            .from('giocatori')
            .insert({
              nome_completo: item.nomeGiocatore,
              ruolo: item.ruolo,
              squadra_id: squadraId,
            })
            .select('id')
            .single();
          giocatoreId = nuovoGiocatore?.id;
        }

        // Aggiorna la tabella probabili_formazioni
        await supabase.from('probabili_formazioni').upsert(
          {
            giocatore_id: giocatoreId,
            percentuale_titolarita: item.percentuale,
            stato: item.stato,
          },
          { onConflict: 'giocatore_id' }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Scraping completato con successo! Processati ${datiFormazioni.length} giocatori.`,
    });
  } catch (error: any) {
    console.error('Errore durante lo scraping in Node.js:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}