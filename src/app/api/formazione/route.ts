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

    const schemaRow = data?.find((row: { posizione?: string }) => row.posizione && row.posizione.startsWith("SCHEMA_"));
    const schemaSalvato = schemaRow ? schemaRow.posizione.replace("SCHEMA_", "") : "4-4-2";

    const titolariRighe = data?.filter((row: { posizione?: string }) => row.posizione === "TITOLARE") || [];
    const panchinaRighe = data?.filter((row: { posizione?: string }) => row.posizione === "PANCHINA") || [];

    const titolari = Array(11).fill(null);
    titolariRighe.forEach((row: { ordine: number; giocatore_id: string }) => {
      if (row.ordine >= 0 && row.ordine < 11) {
        titolari[row.ordine] = row.giocatore_id;
      }
    });

    const panchina = panchinaRighe.map((row: { giocatore_id: string }) => row.giocatore_id);

    return NextResponse.json(
      { schema: schemaSalvato, titolari, panchina },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Errore del server";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { schema, titolari, panchina } = body;

    interface RigaInsert {
      giocatore_id: string;
      posizione: string;
      ordine: number;
    }

    const righeDaInserire: RigaInsert[] = [];

    if (schema) {
      righeDaInserire.push({
        giocatore_id: SCHEMA_UUID,
        posizione: `SCHEMA_${schema}`,
        ordine: -1,
      });
    }

    if (Array.isArray(titolari)) {
      titolari.forEach((giocatoreId: string | null, index: number) => {
        if (giocatoreId) {
          righeDaInserire.push({
            giocatore_id: giocatoreId,
            posizione: "TITOLARE",
            ordine: index,
          });
        }
      });
    }

    if (Array.isArray(panchina)) {
      panchina.forEach((giocatoreId: string | null, index: number) => {
        if (giocatoreId) {
          righeDaInserire.push({
            giocatore_id: giocatoreId,
            posizione: "PANCHINA",
            ordine: index,
          });
        }
      });
    }

    await supabase.from("mia_formazione").delete().neq("ordine", -999);

    const { data, error: insertError } = await supabase
      .from("mia_formazione")
      .insert(righeDaInserire)
      .select();

    if (insertError) {
      console.error("Errore inserimento Supabase:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Errore server";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}