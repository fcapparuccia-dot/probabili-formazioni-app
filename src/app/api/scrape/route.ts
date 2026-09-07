import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import axios from 'axios';

export const maxDuration = 60;

interface GiocatoreMappato {
  nome: string;
  squadra: string;
}

const API_KEY = '3';

// Elenco esplicito delle squadre di Serie A per evitare fallback su leghe estere
const SQUADRE_SERIE_A = [
  'ATALANTA', 'BOLOGNA', 'CAGLIARI', 'COMO', 'EMPOLI', 'FIORENTINA',
  'GENOA', 'INTER', 'JUVENTUS', 'LAZIO', 'LECCE', 'MILAN', 'MONZA',
  'NAPOLI', 'PARMA', 'ROMA', 'TORINO', 'UDINESE', 'VENEZIA', 'VERONA'
];

export async function GET() {
  try {
    const giocatoriMappati: GiocatoreMappato[] = [];
    const visti = new Set<string>();

    for (const squadra of SQUADRE_SERIE_A) {
      try {
        // 1. Cerca l'ID della squadra specifica in Italia
        const teamSearchRes = await axios.get(
          `https://www.thesportsdb.com/api/v1/json/${API_KEY}/searchteams.php?t=${encodeURIComponent(squadra)}`,
          { timeout: 5000 }
        );

        const teams = teamSearchRes.data?.teams || [];
        // Filtra per assicurarsi che sia la squadra italiana (Soccer / Serie A o Italy)
        const teamDb = teams.find(
          (t: any) => t.strSport === 'Soccer' && (t.strCountry === 'Italy' || t.strLeague?.includes('Serie A'))
        ) || teams[0];

        if (!teamDb?.idTeam) continue;

        // 2. Recupera la rosa dei giocatori per quella squadra
        const playersRes = await axios.get(
          `https://www.thesportsdb.com/api/v1/json/${API_KEY}/lookup_all_players.php?id=${teamDb.idTeam}`,
          { timeout: 5000 }
        );

        const players = playersRes.data?.player || [];

        for (const player of players) {
          const nome = player.strPlayer;
          if (nome) {
            const key = `${nome}-${squadra}`;
            if (!visti.has(key)) {
              visti.add(key);
              giocatoriMappati.push({ nome, squadra });
            }
          }
        }
      } catch {
        continue;
      }
    }

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Nessun giocatore estrapolato per la Serie A.',
      });
    }

    // 3. Bulk Upsert Squadre su Supabase
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
      message: 'Sincronizzazione Serie A completata con successo!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 15),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}