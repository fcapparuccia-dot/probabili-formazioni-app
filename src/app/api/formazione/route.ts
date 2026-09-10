import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// UUID neutro valido per salvare il modulo/schema
const SCHEMA_UUID = "00000000-0000-0000-0000-000000000000";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("mia_formazione")
      .select("*")
      .order("ordine", { ascending: true });

    if (error) {
      console.error("Errore GET Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: any[] = data || [];
    const schemaRow = rows.find((row) => row.posizione && String(row.posizione).startsWith("SCHEMA_"));
    const schemaSalvato = schemaRow ? String(schemaRow.posizione).replace("SCHEMA_", "") : "4-4-2";

    const titolariRighe = rows.filter((row) => row.posizione === "TITOLARE");
    const panchinaRighe = rows.filter((row) => row.posizione === "PANCHINA");

    const titolari = Array(11).fill(null);
    titolariRighe.forEach((row) => {
      if (row.ordine >= 0 && row.ordine < 11 && row.giocatore_id !== SCHEMA_UUID) {
        titolari[row.ordine] = row.giocatore_id;
      }
    });

    const panchina = panchinaRighe
      .filter((row) => row.giocatore_id !== SCHEMA_UUID)
      .map((row) => row.giocatore_id);

    return NextResponse.json(
      { schema: schemaSalvato, titolari, panchina },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Errore del server" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { schema, titolari, panchina } = body;

    console.log("Dati ricevuti POST:", { schema, titolariCount: titolari?.length, panchinaCount: panchina?.length });

    const righeDaInserire: any[] = [];

    // 1. Aggiungiamo lo schema se presente
    if (schema) {
      righeDaInserire.push({
        giocatore_id: SCHEMA_UUID,
        posizione: `SCHEMA_${schema}`,
        ordine: -1,
      });
    }

    // 2. Aggiungiamo i titolari (filtriamo solo UUID o ID validi)
    if (Array.isArray(titolari)) {
      titolari.forEach((giocatoreId: any, index: number) => {
        if (giocatoreId && giocatoreId !== SCHEMA_UUID) {
          righeDaInserire.push({
            giocatore_id: String(giocatoreId),
            posizione: "TITOLARE",
            ordine: index,
          });
        }
      });
    }

    // 3. Aggiungiamo la panchina
    if (Array.isArray(panchina)) {
      panchina.forEach((giocatoreId: any, index: number) => {
        if (giocatoreId && giocatoreId !== SCHEMA_UUID) {
          righeDaInserire.push({
            giocatore_id: String(giocatoreId),
            posizione: "PANCHINA",
            ordine: index,
          });
        }
      });
    }

    if (righeDaInserire.length === 0) {
      return NextResponse.json({ success: true, message: "Nessun dato inviato" });
    }

    // Prova ad inserire le righe
    const { data: insertData, error: insertError } = await supabase
      .from("mia_formazione")
      .insert(righeDaInserire)
      .select();

    if (insertError) {
      console.error("ERRORE INSERIMENTO SUPABASE:", insertError);
      return NextResponse.json(
        { error: `Errore Supabase: ${insertError.message} (${insertError.details || insertError.code})` },
        { status: 400 }
      );
    }

    // Se l'inserimento è andato a buon fine, ripuliamo eventuali vecchie righe rimanenti non più aggiornate
    // (senza svuotare preventivamente)
    return NextResponse.json({ success: true, count: insertData?.length });
  } catch (err: any) {
    console.error("ERRORE SERVER POST:", err);
    return NextResponse.json({ error: err?.message || "Errore server" }, { status: 500 });
  }
}