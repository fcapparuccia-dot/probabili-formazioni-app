import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// LEGGERE LA FORMAZIONE DA SUPABASE
export async function GET() {
  try {
    const { data: righeFormazione, error } = await supabase
      .from("mia_formazione")
      .select("giocatore_id, posizione, ordine")
      .order("ordine", { ascending: true });

    if (error || !righeFormazione || righeFormazione.length === 0) {
      console.error("Errore o formazione vuota su Supabase:", error);
      return NextResponse.json(null);
    }

    // Separiamo i titolari (ordinati per slot) e la panchina
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
      schema: "4-4-2", // o lo schema salvato
      titolari,
      panchina,
    });
  } catch (error) {
    console.error("Errore lettura Supabase:", error);
    return NextResponse.json({ error: "Errore lettura dati" }, { status: 500 });
  }
}

// SALVARE LA FORMAZIONE SU SUPABASE
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { titolari, panchina } = body;

    // 1. Svuota la formazione precedente
    await supabase.from("mia_formazione").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const nuoveRighe: any[] = [];

    // 2. Prepara i titolari
    titolari.forEach((id: string | null, idx: number) => {
      if (id) {
        nuoveRighe.push({
          giocatore_id: id,
          posizione: "TITOLARE",
          ordine: idx,
        });
      }
    });

    // 3. Prepara la panchina
    panchina.forEach((id: string, idx: number) => {
      nuoveRighe.push({
        giocatore_id: id,
        posizione: "PANCHINA",
        ordine: idx,
      });
    });

    // 4. Inserisce i nuovi dati
    if (nuoveRighe.length > 0) {
      const { error: insertError } = await supabase
        .from("mia_formazione")
        .insert(nuoveRighe);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore salvataggio Supabase:", error);
    return NextResponse.json({ error: "Errore salvataggio dati" }, { status: 500 });
  }
}