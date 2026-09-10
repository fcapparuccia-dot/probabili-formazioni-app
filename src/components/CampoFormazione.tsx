"use client";

import React, { useState, useEffect } from "react";

export type Giocatore = {
  id: string;
  nome?: string;
  calciatore?: string;
  ruolo?: string;
  ruolo_breve?: string;
  squadra?: string;
  titolare?: boolean;
  panchina?: boolean;
  [key: string]: any;
};

type CampoFormazioneProps = {
  rosa: Giocatore[];
  onApriGestioneRosa: () => void;
};

const SCHEMI_DISPONIBILI = ["4-4-2", "4-3-3", "3-5-2", "3-4-3", "4-2-3-1", "5-3-2"];

export default function CampoFormazione({ rosa, onApriGestioneRosa }: CampoFormazioneProps) {
  const [schema, setSchema] = useState<string>("4-4-2");
  const [titolari, setTitolari] = useState<(string | null)[]>(Array(11).fill(null));
  const [panchina, setPanchina] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  useEffect(() => {
    async function caricaFormazione() {
      try {
        const res = await fetch("/api/formazione");
        if (res.ok) {
          const data = await res.json();
          if (data.schema) setSchema(data.schema);
          if (Array.isArray(data.titolari)) setTitolari(data.titolari);
          if (Array.isArray(data.panchina)) setPanchina(data.panchina);
        }
      } catch (err) {
        console.error("Errore nel caricamento della formazione:", err);
      } finally {
        setIsInitialLoading(false);
      }
    }
    caricaFormazione();
  }, []);

  const salvaSuServer = async (
    nuovoSchema: string,
    nuoviTitolari: (string | null)[],
    nuovaPanchina: string[]
  ) => {
    setIsSaving(true);
    try {
      await fetch("/api/formazione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: nuovoSchema,
          titolari: nuoviTitolari,
          panchina: nuovaPanchina,
        }),
      });
    } catch (err) {
      console.error("Errore salvataggio server:", err);
    } finally {
      setTimeout(() => setIsSaving(false), 300);
    }
  };

  const cambiaSchema = (nuovoSchema: string) => {
    setSchema(nuovoSchema);
    salvaSuServer(nuovoSchema, titolari, panchina);
  };

  const gestisciSelezionaTitolare = (giocatoreId: string, slotIndex: number) => {
    const nuoviTitolari = [...titolari];
    const indexEsistente = nuoviTitolari.indexOf(giocatoreId);
    if (indexEsistente !== -1) {
      nuoviTitolari[indexEsistente] = null;
    }

    nuoviTitolari[slotIndex] = giocatoreId;
    setTitolari(nuoviTitolari);

    const nuovaPanchina = panchina.filter((id) => id !== giocatoreId);
    setPanchina(nuovaPanchina);

    salvaSuServer(schema, nuoviTitolari, nuovaPanchina);
  };

  const rimuoviTitolare = (slotIndex: number) => {
    const nuoviTitolari = [...titolari];
    nuoviTitolari[slotIndex] = null;
    setTitolari(nuoviTitolari);
    salvaSuServer(schema, nuoviTitolari, panchina);
  };

  const togglePanchina = (giocatoreId: string) => {
    let nuovaPanchina = [...panchina];
    let nuoviTitolari = [...titolari];

    const idxTitolare = nuoviTitolari.indexOf(giocatoreId);
    if (idxTitolare !== -1) {
      nuoviTitolari[idxTitolare] = null;
    }

    if (nuovaPanchina.includes(giocatoreId)) {
      nuovaPanchina = nuovaPanchina.filter((id) => id !== giocatoreId);
    } else {
      nuovaPanchina.push(giocatoreId);
    }

    setTitolari(nuoviTitolari);
    setPanchina(nuovaPanchina);
    salvaSuServer(schema, nuoviTitolari, nuovaPanchina);
  };

  const getNomeGiocatore = (g: Giocatore) => g.nome || g.calciatore || "Giocatore";
  const getRuoloGiocatore = (g: Giocatore) => g.ruolo || g.ruolo_breve || "";

  if (isInitialLoading) {
    return (
      <div className="p-8 text-center text-gray-400">
        Caricamento formazione in corso...
      </div>
    );
  }

  if (!rosa || rosa.length === 0) {
    return (
      <div className="border border-amber-500/30 bg-slate-900/60 rounded-xl p-8 text-center shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            ⭐ La Mia Formazione
          </h2>
          <button
            onClick={onApriGestioneRosa}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg transition-all"
          >
            ✏️ Gestisci Rosa
          </button>
        </div>
        <p className="text-gray-400 italic">
          Nessun giocatore in rosa. Clicca su &quot;Gestisci Rosa&quot; in alto per inserire i tuoi calciatori!
        </p>
      </div>
    );
  }

  return (
    <div className="border border-amber-500/30 bg-slate-900/60 rounded-xl p-6 shadow-lg mb-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            ⭐ La Mia Formazione
          </h2>
          {isSaving && (
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded animate-pulse">
              Salvataggio...
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300 font-medium">Schema:</label>
            <select
              value={schema}
              onChange={(e) => cambiaSchema(e.target.value)}
              className="bg-slate-800 text-white font-semibold border border-amber-500/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400"
            >
              {SCHEMI_DISPONIBILI.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onApriGestioneRosa}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg transition-all text-sm"
          >
            ✏️ Gestisci Rosa
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
          🏃 Titolari (11)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {titolari.map((giocatoreId, idx) => {
            const giocatore = rosa.find((g) => String(g.id) === String(giocatoreId));

            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border flex flex-col justify-between min-h-[90px] ${
                  giocatore
                    ? "bg-slate-800/80 border-amber-500/40"
                    : "bg-slate-950/40 border-dashed border-gray-700"
                }`}
              >
                <div className="text-xs text-amber-400 font-semibold mb-1">
                  Slot #{idx + 1}
                </div>

                {giocatore ? (
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-white text-sm">{getNomeGiocatore(giocatore)}</div>
                      <div className="text-xs text-gray-400">
                        {getRuoloGiocatore(giocatore)} {giocatore.squadra ? `- ${giocatore.squadra}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => rimuoviTitolare(idx)}
                      className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded bg-red-950/30"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value=""
                    onChange={(e) => gestisciSelezionaTitolare(e.target.value, idx)}
                    className="bg-slate-900 text-gray-400 border border-slate-700 rounded text-xs p-1.5 focus:outline-none"
                  >
                    <option value="" disabled>
                      -- Seleziona Giocatore --
                    </option>
                    {rosa
                      .filter((g) => !titolari.includes(String(g.id)) && !panchina.includes(String(g.id)))
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {getNomeGiocatore(g)} ({getRuoloGiocatore(g)})
                        </option>
                      ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-200 mb-3">🪑 Panchina</h3>
        <div className="flex flex-wrap gap-2">
          {rosa.map((g) => {
            const isTitolare = titolari.includes(String(g.id));
            const isPanchina = panchina.includes(String(g.id));

            return (
              <button
                key={g.id}
                onClick={() => togglePanchina(String(g.id))}
                disabled={isTitolare}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  isTitolare
                    ? "opacity-30 cursor-not-allowed bg-slate-800 border-slate-700 text-gray-400"
                    : isPanchina
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/60"
                    : "bg-slate-800/60 text-gray-300 border-slate-700 hover:border-gray-500"
                }`}
              >
                {getNomeGiocatore(g)} ({getRuoloGiocatore(g)}) {isPanchina && "✓"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}