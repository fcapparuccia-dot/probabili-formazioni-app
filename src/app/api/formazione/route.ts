import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SCHEMA_UUID = "00000000-0000-0000-0000-000000000000";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("mia_formazione")
      .select("*")
      .order("ordine", { ascending: true });

    if (error) {
      console.error("Errore recupero Supabase:", error);
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

    const righeDaInserire: any[] = [];

    if (schema) {
      righeDaInserire.push({
        giocatore_id: SCHEMA_UUID,
        posizione: `SCHEMA_${schema}`,
        ordine: -1,
      });
    }

    if (Array.isArray(titolari)) {
      titolari.forEach((giocatoreId: any, index: number) => {
        if (giocatoreId && giocatoreId !== SCHEMA_UUID) {
          righeDaInserire.push({
            giocatore_id: giocatoreId,
            posizione: "TITOLARE",
            ordine: index,
          });
        }
      });
    }

    if (Array.isArray(panchina)) {
      panchina.forEach((giocatoreId: any, index: number) => {
        if (giocatoreId && giocatoreId !== SCHEMA_UUID) {
          righeDaInserire.push({
            giocatore_id: giocatoreId,
            posizione: "PANCHINA",
            ordine: index,
          });
        }
      });
    }

    // Se non ci sono righe valide da inserire, cancelliamo solo lo schema vecchio e preserviamo la rosa
    if (righeDaInserire.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Svuota solo prima dell'inserimento confermato
    const { error: deleteError } = await supabase.from("mia_formazione").delete().neq("ordine", -999);
    if (deleteError) {
      console.error("Errore durante delete:", deleteError);
    }

    const { data, error: insertError } = await supabase
      .from("mia_formazione")
      .insert(righeDaInserire)
      .select();

    if (insertError) {
      console.error("Errore inserimento Supabase:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Errore server" }, { status: 500 });
  }
}