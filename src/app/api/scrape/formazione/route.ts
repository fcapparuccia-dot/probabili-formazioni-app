import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Inizializza il client Redis sfruttando le variabili automatiche di Vercel
const redis = Redis.fromEnv();

export async function GET() {
  try {
    const data = await redis.get("formazione_utente");

    if (!data) {
      return NextResponse.json(null);
    }

    // Se i dati sono già un oggetto non occorre fare JSON.parse
    const formazione = typeof data === "string" ? JSON.parse(data) : data;
    return NextResponse.json(formazione);
  } catch (error) {
    console.error("Errore lettura Redis:", error);
    return NextResponse.json({ error: "Errore lettura dati" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Salva i dati direttamente su Redis
    await redis.set("formazione_utente", body);

    return NextResponse.json({ success: true, ...body });
  } catch (error) {
    console.error("Errore salvataggio Redis:", error);
    return NextResponse.json({ error: "Errore salvataggio dati" }, { status: 500 });
  }
}