import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper per verificare se una stringa è un UUID valido
function isUUID(str: string) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(str);
}

// GET: Recupera la formazione salvata
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('mia_formazione')
      .select('*')
      .order('ordine', { ascending: true });

    if (error) {
      console.error('Errore lettura Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ titolari: [], panchina: [], schema: '4-4-2' });
    }

    const titolari = data.filter((row: any) => row.posizione === 'TITOLARE').map((row: any) => row.giocatore_id);
    const panchina = data.filter((row: any) => row.posizione === 'PANCHINA').map((row: any) => row.giocatore_id);

    return NextResponse.json({ schema: '4-4-2', titolari, panchina });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Salva la nuova formazione
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { titolari, panchina } = body;

    // 1. Cancella i record esistenti filtrando sulla colonna "posizione"
    const { error: deleteError } = await supabase
      .from('mia_formazione')
      .delete()
      .in('posizione', ['TITOLARE', 'PANCHINA']);

    if (deleteError) {
      console.error('Errore svuotamento tabella:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // 2. Mappa i titolari validi (soltanto con UUID validi)
    const titolariRows = (titolari || [])
      .filter((id: any): id is string => typeof id === 'string' && isUUID(id))
      .map((id: string, idx: number) => ({
        giocatore_id: id,
        posizione: 'TITOLARE',
        ordine: idx,
      }));

    // 3. Mappa la panchina valida (soltanto con UUID validi)
    const panchinaRows = (panchina || [])
      .filter((id: any): id is string => typeof id === 'string' && isUUID(id))
      .map((id: string, idx: number) => ({
        giocatore_id: id,
        posizione: 'PANCHINA',
        ordine: idx,
      }));

    const rowsToInsert = [...titolariRows, ...panchinaRows];

    // 4. Inserisci i nuovi dati
    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('mia_formazione')
        .insert(rowsToInsert);

      if (insertError) {
        console.error('Errore inserimento Supabase:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}