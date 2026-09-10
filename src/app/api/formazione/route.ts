import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

    // Separiamo titolari (ordinati 0..10) e panchina
    const titolariRighe = data.filter((row: any) => row.posizione === "TITOLARE");
    const panchinaRighe = data.filter((row: any) => row.posizione === "PANCHINA");

    const titolari = Array(11).fill(null);
    titolariRighe.forEach((row: any) => {
      if (row.ordine >= 0 && row.ordine < 11) {
        titolari[row.ordine] = row.giocatore_id;
      }
    });

    const panchina = panchinaRighe.map((row: any) => row.giocatore_id);

    return NextResponse.json(
      { schema: "4-4-2", titolari, panchina },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Errore del server" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { titolari, panchina } = body; // Array di UUID di giocatori

    // Prepara tutte le righe da inserire/aggiornare
    const righeDaInserire: any[] = [];

    // Titolari con il loro ordine esatto da 0 a 10
    titolari.forEach((giocatoreId: string | null, index: number) => {
      if (giocatoreId) {
        righeDaInserire.push({
          giocatore_id: giocatoreId,
          posizione: "TITOLARE",
          ordine: index,
        });
      }
    });

    // Panchinari con ordine progressivo
    panchina.forEach((giocatoreId: string, index: number) => {
      if (giocatoreId) {
        righeDaInserire.push({
          giocatore_id: giocatoreId,
          posizione: "PANCHINA",
          ordine: index,
        });
      }
    });

    // Svuota la tabella attuale e reinserisce le nuove posizioni corrette
    const { error: deleteError } = await supabase
      .from("mia_formazione")
      .delete()
      .neq("ordine", -999);

    if (deleteError) {
      console.error("Errore pulizia mia_formazione:", deleteError);
    }

    const { data, error: insertError } = await supabase
      .from("mia_formazione")
      .insert(righeDaInserire)
      .select();

    if (insertError) {
      console.error("Errore inserimento mia_formazione:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Errore salvataggio server" }, { status: 500 });
  }
}