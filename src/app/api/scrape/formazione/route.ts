import { NextResponse } from "next/server";
import { createClient } from "redis";

async function getRedisClient() {
  const client = createClient({
    url: process.env.REDIS_URL,
  });
  client.on("error", (err) => console.error("Redis Client Error", err));
  await client.connect();
  return client;
}

export async function GET() {
  let client;
  try {
    client = await getRedisClient();
    const data = await client.get("formazione_utente");
    await client.disconnect();

    if (!data) {
      return NextResponse.json(null);
    }

    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    if (client) await client.disconnect();
    console.error("Errore lettura Redis:", error);
    return NextResponse.json({ error: "Errore lettura dati" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let client;
  try {
    const body = await req.json();
    client = await getRedisClient();
    await client.set("formazione_utente", JSON.stringify(body));
    await client.disconnect();

    return NextResponse.json({ success: true, ...body });
  } catch (error) {
    if (client) await client.disconnect();
    console.error("Errore salvataggio Redis:", error);
    return NextResponse.json({ error: "Errore salvataggio dati" }, { status: 500 });
  }
}