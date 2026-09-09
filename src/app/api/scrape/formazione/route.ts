import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Forza Vercel e Next.js a richiedere SEMPRE dati freschi a Supabase
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Legge la formazione da Supabase per qualsiasi dispositivo
export async function GET() {
  try {
    const { data: righe, error } = await supabase
      .from("mia_formazione")
      .select("giocatore_id, posizione, ordine")
      .order("ordine", { ascending: true });

    if (error || !righe || righe.length === 0) {
      return NextResponse.json(null);
    }

    const titolari: (string | null)[] = [];
    const panchina: string[] = [];

    righe.forEach((r) => {
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
    return NextResponse.json({ error: "Errore lettura" }, { status: 500 });
  }
}

// POST: Salva la formazione modificata su Supabase
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { titolari, panchina } = body;

    // Svuota i vecchi record della formazione
    await supabase.from("mia_formazione").delete().gte("ordine", 0);

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

    if (nuoveRighe.length > 0) {
      const { error: insertError } = await supabase
        .from("mia_formazione")
        .insert(nuoveRighe);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Errore salvataggio" }, { status: 500 });
  }
}