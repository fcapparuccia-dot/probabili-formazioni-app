import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: righeFormazione, error } = await supabase
      .from("mia_formazione")
      .select("giocatore_id, posizione, ordine")
      .order("ordine", { ascending: true });

    if (error) {
      console.error("Errore lettura Supabase:", error);
      return NextResponse.json(null);
    }

    if (!righeFormazione || righeFormazione.length === 0) {
      return NextResponse.json(null);
    }

    const titolari: (string | null)[] = [];
    const panchina: string[] = [];

    righeFormazione.forEach((r) => {
      if (r.posizione === "TITOLARE") {
        titolari.push(r.giocatore_id);
      } else {
        panchina.push(r.giocatore_id);
      }
    });

    return NextResponse.json({
      schema: "4-4-2",
      titolari,
      panchina,
    });
  } catch (error) {
    console.error("Errore GET API:", error);
    return NextResponse.json({ error: "Errore lettura" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { titolari, panchina } = body;

    // 1. Svuota la formazione esistente
    const { error: deleteError } = await supabase
      .from("mia_formazione")
      .delete()
      .gte("ordine", 0); // Cancella tutte le righe esistenti

    if (deleteError) {
      console.error("Errore DELETE Supabase:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // 2. Prepara le righe da inserire
    const nuoveRighe: any[] = [];

    titolari.forEach((id: string | null, idx: number) => {
      if (id) {
        nuoveRighe.push({
          giocatore_id: id,
          posizione: "TITOLARE",
          ordine: idx,
        });
      }
    });

    panchina.forEach((id: string, idx: number) => {
      if (id) {
        nuoveRighe.push({
          giocatore_id: id,
          posizione: "PANCHINA",
          ordine: idx,
        });
      }
    });

    // 3. Inserimento
    if (nuoveRighe.length > 0) {
      const { error: insertError } = await supabase
        .from("mia_formazione")
        .insert(nuoveRighe);

      if (insertError) {
        console.error("Errore INSERT Supabase:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Errore server POST:", error);
    return NextResponse.json({ error: error?.message || "Errore generico" }, { status: 500 });
  }
}