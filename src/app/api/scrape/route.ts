import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import axios from 'axios';

export const maxDuration = 60;

interface GiocatoreMappato {
  nome: string;
  squadra: string;
}

// ID Serie A su TheSportsDB = 4332
const LEAGUE_ID = '4332';
const API_KEY = '3'; // Chiave API pubblica/free fornita da TheSportsDB

export async function GET() {
  try {
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    // 1. Recupera la lista delle squadre della Serie A
    const teamsRes = await axios.get(
      `https://www.thesportsdb.com/api/v1/json/${API_KEY}/lookup_all_teams.php?id=${LEAGUE_ID}`,
      { timeout: 10000 }
    );

    const teams = teamsRes.data?.teams || [];

    if (teams.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile recuperare le squadre da TheSportsDB.',
      });
    }

    // 2. Per ogni squadra, recupera la rosa completa dei giocatori
    for (const team of teams) {
      const teamId = team.idTeam;
      const teamName = team.strTeam.toUpperCase();

      try {
        const playersRes = await axios.get(
          `https://www.thesportsdb.com/api/v1/json/${API_KEY}/lookup_all_players.php?id=${teamId}`,
          { timeout: 5000 }
        );

        const players = playersRes.data?.player || [];

        for (const player of players) {
          const nome = player.strPlayer;
          if (nome) {
            const key = `${nome}-${teamName}`;
            if (!visti.has(key)) {
              visti.add(key);
              giocatoriMappati.push({ nome, squadra: teamName });
            }
          }
        }
      } catch {
        // Se una chiamata a un team va in timeout o fallisce, prosegue con le altre squadre
        continue;
      }
    }

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Nessun giocatore estrapolato dall\'API.',
      });
    }

    // 3. Bulk Upsert Squadre
    const squadreUniche = Array.from(new Set(giocatoriMappati.map((g) => g.squadra)));
    const { data: squadreDb } = await supabase
      .from('squadre')
      .upsert(squadreUniche.map((nome) => ({ nome })), { onConflict: 'nome' })
      .select('id, nome');

    const squadraMap = new Map(squadreDb?.map((s) => [s.nome, s.id]));

    // 4. Bulk Upsert Giocatori
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

    // 5. Bulk Upsert Probabili Formazioni
    if (giocatoriDb && giocatoriDb.length > 0) {
      const formazioniData = giocatoriDb.map((g) => ({
        giocatore_id: g.id,
        fonte: 'TheSportsDB',
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
      message: 'Sincronizzazione API completata con successo!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 15),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}