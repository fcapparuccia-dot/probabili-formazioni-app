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

const FRASI_DA_EVITARE = [
  'NESSUNA NOTIZIA', 'DUBBIO', 'INFORTUNIO', 'OUT', 'NOIE FISICHE',
  'CONTRO IL', 'RIENTRO', 'SQUALIFICATO', 'RISENTIMENTO', 'LESIONE',
  'DISTORSIONE', 'AFFATICAMENTO', 'PROBLEMA', 'OPERAZIONE', 'PANCHINA', 'BALLOTTAGGIO'
];

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

    // STRATEGIA UNIVERSALE:
    // Troviamo direttamente tutti i link ai giocatori nella pagina
    $('a[href*="/giocatori/"]').each((_, playerEl) => {
      const rawText = $(playerEl).text().trim();
      if (!rawText) return;

      let nomePulito = rawText
        .split('\n')[0]
        .replace(/^[PDCAR]\s+/i, '')
        .replace(/\d+%/g, '')
        .replace(/[\n\r\t]+/g, '')
        .trim();

      const nomeUpper = nomePulito.toUpperCase();
      const eInfortunioONota = FRASI_DA_EVITARE.some((frase) => nomeUpper.includes(frase));

      if (
        !nomePulito ||
        nomePulito.length < 3 ||
        nomePulito.length > 30 ||
        eInfortunioONota ||
        nomePulito.includes('VS') ||
        /^\d[-\d]+\d$/.test(nomePulito) ||
        SQUADRE_SERIE_A.includes(nomeUpper) ||
        !isNaN(Number(nomePulito))
      ) {
        return;
      }

      // Troviamo la squadra associata risalendo al contenitore più vicino che ne menziona una
      let squadraTrovata = '';
      let parent = $(playerEl).parent();
      
      for (let i = 0; i < 6; i++) {
        if (!parent || parent.length === 0) break;
        
        const parentText = parent.text().toUpperCase();
        for (const sq of SQUADRE_SERIE_A) {
          if (parentText.includes(sq)) {
            squadraTrovata = sq;
            break;
          }
        }
        if (squadraTrovata) break;
        parent = parent.parent();
      }

      // Default di sicurezza se il contenitore padre non ha la squadra esplicita
      if (!squadraTrovata) {
        squadraTrovata = 'GENOA'; 
      }

      const chiaveUnica = `${nomePulito}-${squadraTrovata}`;
      if (!visti.has(chiaveUnica)) {
        visti.add(chiaveUnica);
        giocatoriMappati.push({ nome: nomePulito, squadra: squadraTrovata });
      }
    });

    if (giocatoriMappati.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile estrarre le formazioni. Nessun link giocatore individuato.',
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