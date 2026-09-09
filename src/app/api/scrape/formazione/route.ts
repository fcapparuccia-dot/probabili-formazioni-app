import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Inizializza Redis usando REDIS_URL presente su Vercel
const redis = Redis.fromEnv({
  url: process.env.REDIS_URL || "",
  token: "", // Non serve se la stringa REDIS_URL è completa o rediss://
});

export async function GET() {
  try {
    const data = await redis.get("formazione_utente");

    if (!data) {
      return NextResponse.json(null);
    }

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
    await redis.set("formazione_utente", body);

    return NextResponse.json({ success: true, ...body });
  } catch (error) {
    console.error("Errore salvataggio Redis:", error);
    return NextResponse.json({ error: "Errore salvataggio dati" }, { status: 500 });
  }
}