import { NextResponse } from "next/server";
import Redis from "ioredis";

// Inizializza il client Redis usando REDIS_URL
const redis = new Redis(process.env.REDIS_URL || "");

export async function GET() {
  try {
    const data = await redis.get("formazione_utente");

    if (!data) {
      return NextResponse.json(null);
    }

    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error("Errore lettura Redis:", error);
    return NextResponse.json({ error: "Errore lettura dati" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Salva la formazione come stringa JSON
    await redis.set("formazione_utente", JSON.stringify(body));

    return NextResponse.json({ success: true, ...body });
  } catch (error) {
    console.error("Errore salvataggio Redis:", error);
    return NextResponse.json({ error: "Errore salvataggio dati" }, { status: 500 });
  }
}