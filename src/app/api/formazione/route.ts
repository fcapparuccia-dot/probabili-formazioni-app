import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// GET: Recupera la formazione salvata
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('mia_formazione')
      .select('*');

    if (error) {
      console.error('Errore lettura Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ titolari: [], panchina: [], schema: '4-4-2' });
    }

    const schema = data[0]?.schema || '4-4-2';
    const titolari = data.filter((row: any) => row.ruolo === 'titolare').map((row: any) => row.giocatore_id);
    const panchina = data.filter((row: any) => row.ruolo === 'panchina').map((row: any) => row.giocatore_id);

    return NextResponse.json({ schema, titolari, panchina });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Salva la nuova formazione
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schema, titolari, panchina } = body;

    // Cancella tutte le righe esistenti usando la colonna ruolo (garantita presente)
    const { error: deleteError } = await supabase
      .from('mia_formazione')
      .delete()
      .in('ruolo', ['titolare', 'panchina']);

    if (deleteError) {
      console.error('Errore pulizia vecchia formazione:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Prepara i nuovi dati
    const rowsToInsert = [
      ...(titolari || []).filter(Boolean).map((id: string) => ({
        giocatore_id: id,
        ruolo: 'titolare',
        schema: schema,
      })),
      ...(panchina || []).filter(Boolean).map((id: string) => ({
        giocatore_id: id,
        ruolo: 'panchina',
        schema: schema,
      })),
    ];

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