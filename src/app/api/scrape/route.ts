import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const maxDuration = 60; // Imposta il timeout massimo supportato

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
      timeout: 5000,
    });

    const $ = cheerio.load(html);
    const giocatoriMappati: GiocatoreMappato[] = [];

    // Estrazione veloce dai blocchi squadra
    $('[class*="team"]').each((_, teamBlock) => {
      const squadra = $(teamBlock)
        .find('h3, h4, .title, .team-name, .name')
        .first()
        .text()
        .trim()
        .toUpperCase();

      if (!squadra) return;

      $(teamBlock).find('[class*="player"]').each((_, p) => {
        const nome = $(p).text().trim().replace(/^[PDCAR]\s+/i, '').trim();
        if (nome && nome.length > 2 && !nome.includes('VS')) {
          giocatoriMappati.push({ nome, squadra });
        }
      });
    });

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile estrarre le formazioni. Nessun giocatore trovato.',
      });
    }

    // 1. Estrai tutte le squadre uniche ed effettua un upsert unico
    const squadreUniche = Array.from(new Set(giocatoriMappati.map((g) => g.squadra)));
    const { data: squadreDb } = await supabase
      .from('squadre')
      .upsert(squadreUniche.map((nome) => ({ nome })), { onConflict: 'nome' })
      .select('id, nome');

    const squadraMap = new Map(squadreDb?.map((s) => [s.nome, s.id]));

    // 2. Prepara i giocatori con la squadra_id corretta
    const giocatoriDaInserire = giocatoriMappati
      .filter((g) => squadraMap.has(g.squadra))
      .map((g) => ({
        nome_completo: g.nome,
        squadra_id: squadraMap.get(g.squadra)!,
      }));

    // Inserisci/aggiorna i giocatori in bulk (in un'unica operazione)
    const { data: giocatoriDb } = await supabase
      .from('giocatori')
      .upsert(giocatoriDaInserire, { onConflict: 'nome_completo' })
      .select('id');

    if (giocatoriDb && giocatoriDb.length > 0) {
      // 3. Salvataggio in batch delle probabili formazioni
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
      message: 'Sincronizzazione ultra-rapida completata!',
      totaleGiocatoriMappati: giocatoriMappati.length,
      campione: giocatoriMappati.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}