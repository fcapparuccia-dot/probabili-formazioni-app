import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("formazioni")
      .select("dati")
      .eq("id", "default")
      .single();

    if (error || !data) return NextResponse.json(null);

    return NextResponse.json(data.dati);
  } catch (error) {
    return NextResponse.json({ error: "Errore lettura Supabase" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { error } = await supabase
      .from("formazioni")
      .upsert({ id: "default", dati: body, updated_at: new Date().toISOString() });

    if (error) throw error;

    return NextResponse.json({ success: true, ...body });
  } catch (error) {
    return NextResponse.json({ error: "Errore salvataggio Supabase" }, { status: 500 });
  }
}