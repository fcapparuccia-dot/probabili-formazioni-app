import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// File locale dove verrà salvata la formazione sul server
const filePath = path.join(process.cwd(), "formazione.json");

// Legge la formazione salvata
export async function GET() {
  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ formazione: null });
    }
    const data = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ formazione: JSON.parse(data) });
  } catch (error) {
    console.error("Errore lettura formazione:", error);
    return NextResponse.json({ error: "Errore lettura file" }, { status: 500 });
  }
}

// Salva la formazione
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { schema, titolari, panchina } = body;

    const nuovaFormazione = {
      schema,
      titolari,
      panchina,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(nuovaFormazione, null, 2), "utf-8");

    return NextResponse.json({ success: true, formazione: nuovaFormazione });
  } catch (error) {
    console.error("Errore salvataggio formazione:", error);
    return NextResponse.json({ error: "Errore salvataggio file" }, { status: 500 });
  }
}