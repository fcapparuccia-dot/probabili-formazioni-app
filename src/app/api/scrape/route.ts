import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import axios from 'axios';

export const maxDuration = 60;

interface GiocatoreMappato {
  nome: string;
  squadra: string;
}

const HEADERS_SOFASCORE = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8',
  'Origin': 'https://www.sofascore.com',
  'Referer': 'https://www.sofascore.com/',
};

// ID Serie A su Sofascore: Unique Tournament ID = 23
const SERIE_A_TOURNAMENT_ID = 23;

export async function GET() {
  try {
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    // 1. Otteniamo la stagione e il round/turno corrente della Serie A
    const seasonRes = await axios.get(
      `https://api.sofascore.com/api/v1/unique-tournament/${SERIE_A_TOURNAMENT_ID}/seasons`,
      { headers: HEADERS_SOFASCORE, timeout: 8000 }
    );
    const currentSeasonId = seasonRes.data.seasons[0]?.id;

    if (!currentSeasonId) {
      throw new Error('Impossibile recuperare la stagione corrente da Sofascore');
    }

    // 2. Recuperiamo gli eventi/partite del turno corrente
    const eventsRes = await axios.get(
      `https://api.sofascore.com/api/v1/unique-tournament/${SERIE_A_TOURNAMENT_ID}/season/${currentSeasonId}/events/next/0`,
      { headers: HEADERS_SOFASCORE, timeout: 8000 }
    );

    const events = eventsRes.data.events || [];

    // 3. Per ogni partita del turno, recuperiamo le formazioni
    for (const match of events.slice(0, 10)) {
      const eventId = match.id;
      const homeTeam = match.homeTeam?.name?.toUpperCase();
      const awayTeam = match.awayTeam?.name?.toUpperCase();

      try {
        const lineupRes = await axios.get(
          `https://api.sofascore.com/api/v1/event/${eventId}/lineups`,
          { headers: HEADERS_SOFASCORE, timeout: 5000 }
        );

        const { home, away } = lineupRes.data;

        // Estrazione giocatori Casa
        if (home?.players) {
          for (const item of home.players) {
            const player = item.player;
            const nome = player.shortName || player.name;
            if (nome && homeTeam) {
              const key = `${nome}-${homeTeam}`;
              if (!visti.has(key)) {
                visti.add(key);
                giocatoriMappati.push({ nome, squadra: homeTeam });
              }
            }
          }
        }

        // Estrazione giocatori Trasferta
        if (away?.players) {
          for (const item of away.players) {
            const player = item.player;
            const nome = player.shortName || player.name;
            if (nome && awayTeam) {
              const key = `${nome}-${awayTeam}`;
              if (!visti.has(key)) {
                visti.add(key);
                giocatoriMappati.push({ nome, squadra: awayTeam });
              }
            }
          }
        }
      } catch {
        // Se per una specifica partita le formazioni non sono ancora disponibili, passa alla successiva
        continue;
      }
    }

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Nessuna formazione trovata su Sofascore per il turno corrente.',
      });
    }

    // 4. Bulk Upsert Squadre su Supabase
    const squadreUniche = Array.from(new Set(giocatoriMappati.map((g) => g.squadra)));
    const { data: squadreDb } = await supabase
      .from('squadre')
      .upsert(squadreUniche.map((nome) => ({ nome })), { onConflict: 'nome' })
      .select('id, nome');

    const squadraMap = new Map(squadreDb?.map((s) => [s.nome, s.id]));

    // 5. Bulk Upsert Giocatori
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

    // 6. Bulk Upsert Formazioni
    if (giocatoriDb && giocatoriDb.length > 0) {
      const formazioniData = giocatoriDb.map((g) => ({
        giocatore_id: g.id,
        fonte: 'Sofascore',
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
      message: 'Sincronizzazione da Sofascore completata con successo!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 15),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}