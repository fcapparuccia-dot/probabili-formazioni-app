import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// DISABILITA TOTALMENTE LA CACHE DI NEXT.JS / VERCEL PER QUESTA ROTTA
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
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Errore recupero Supabase:", error);
      return NextResponse.json(
        { error: error.message },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    return NextResponse.json(data || { schema: "4-4-2", titolari: [], panchina: [] }, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore del server" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schema, titolari, panchina } = body;

    // Recupera l'ultimo record per aggiornarlo, oppure ne inserisce uno nuovo
    const { data: existing } = await supabase
      .from("mia_formazione")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    let result;
    if (existing?.id) {
      result = await supabase
        .from("mia_formazione")
        .update({
          schema,
          titolari,
          panchina,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select();
    } else {
      result = await supabase
        .from("mia_formazione")
        .insert([
          {
            schema,
            titolari,
            panchina,
            updated_at: new Date().toISOString(),
          },
        ])
        .select();
    }

    if (result.error) {
      console.error("Errore salvataggio Supabase:", result.error);
      return NextResponse.json(
        { error: result.error.message },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Errore salvataggio server" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}