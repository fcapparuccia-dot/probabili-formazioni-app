import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import * as cheerio from 'cheerio';

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
    const url = 'https://sport.sky.it/calcio/serie-a/probabili-formazioni';
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(html);
    const giocatoriMappati: GiocatoreMappato[] = [];

    // Estraiamo la lista ordinata di tutte le squadre individuate nella pagina
    const sequenzaSquadre: string[] = [];
    $('.ftbl__teams-tabs__tab').each((_, el) => {
      const testo = $(el).text().trim().toUpperCase();
      const sq = SQUADRE_SERIE_A.find((s) => testo.includes(s));
      if (sq) {
        sequenzaSquadre.push(sq);
      }
    });

    // Estraiamo la lista ordinata di tutti i giocatori
    const tuttiGiocatori: string[] = [];
    $('[class*="player"]').each((_, el) => {
      let nome = $(el).text().trim().replace(/^\d+/, '').trim();
      if (nome && nome.length > 2 && !nome.includes('VS') && !SQUADRE_SERIE_A.includes(nome.toUpperCase())) {
        if (!tuttiGiocatori.includes(nome)) {
          tuttiGiocatori.push(nome);
        }
      }
    });

    // Assegnazione logica a blocchi di 11 giocatori per squadra
    let playerIndex = 0;
    for (let i = 0; i < sequenzaSquadre.length; i++) {
      const squadraAttuale = sequenzaSquadre[i];
      // Ogni squadra legge i successivi 11 giocatori disponibili
      for (let count = 0; count < 11 && playerIndex < tuttiGiocatori.length; count++) {
        giocatoriMappati.push({
          nome: tuttiGiocatori[playerIndex],
          squadra: squadraAttuale,
        });
        playerIndex++;
      }
    }

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile estrarre la combinazione squadre-giocatori.',
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
        }

        if (giocatoreDb) {
          await supabase.from('probabili_formazioni').upsert(
            {
              giocatore_id: giocatoreDb.id,
              fonte: 'Sky Sport',
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
      message: 'Mappatura per blocchi di 11 completata!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 15),
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}