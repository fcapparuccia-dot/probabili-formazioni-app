"use client";

import { useState } from "react";

interface Giocatore {
  id: string;
  nome: string;
  squadra: string;
  percentuale?: number;
  stato?: string;
}

interface Props {
  rosa: Giocatore[];
  onApriGestioneRosa: () => void;
}

// Mappatura delle posizioni tattiche in base allo schema
const SCHEMI: Record<string, { ruolo: string; etichetta: string }[]> = {
  "4-3-3": [
    { ruolo: "POR", etichetta: "POR" },
    { ruolo: "DD", etichetta: "TD" },
    { ruolo: "DC1", etichetta: "DC" },
    { ruolo: "DC2", etichetta: "DC" },
    { ruolo: "DS", etichetta: "TS" },
    { ruolo: "CC1", etichetta: "MEZ" },
    { ruolo: "MED", etichetta: "MED" },
    { ruolo: "CC2", etichetta: "MEZ" },
    { ruolo: "ED", etichetta: "AD" },
    { ruolo: "PC", etichetta: "PC" },
    { ruolo: "ES", etichetta: "AS" },
  ],
  "4-4-2": [
    { ruolo: "POR", etichetta: "POR" },
    { ruolo: "DD", etichetta: "TD" },
    { ruolo: "DC1", etichetta: "DC" },
    { ruolo: "DC2", etichetta: "DC" },
    { ruolo: "DS", etichetta: "TS" },
    { ruolo: "ED", etichetta: "CLD" },
    { ruolo: "CC1", etichetta: "CC" },
    { ruolo: "CC2", etichetta: "CC" },
    { ruolo: "ES", etichetta: "CLS" },
    { ruolo: "PC1", etichetta: "ATT" },
    { ruolo: "PC2", etichetta: "ATT" },
  ],
  "3-5-2": [
    { ruolo: "POR", etichetta: "POR" },
    { ruolo: "DC1", etichetta: "DC" },
    { ruolo: "DC2", etichetta: "DC" },
    { ruolo: "DC3", etichetta: "DC" },
    { ruolo: "ED", etichetta: "E" },
    { ruolo: "CC1", etichetta: "CC" },
    { ruolo: "MED", etichetta: "MED" },
    { ruolo: "CC2", etichetta: "CC" },
    { ruolo: "ES", etichetta: "E" },
    { ruolo: "PC1", etichetta: "ATT" },
    { ruolo: "PC2", etichetta: "ATT" },
  ],
};

export default function CampoFormazione({ rosa, onApriGestioneRosa }: Props) {
  const [modulo, setModulo] = useState<string>("4-3-3");
  const [titolari, setTitolari] = useState<Record<number, string>>({});

  const posizioni = SCHEMI[modulo] || SCHEMI["4-3-3"];

  const impostaTitolare = (index: number, giocatoreId: string) => {
    setTitolari((prev) => {
      const nuovo = { ...prev };
      if (!giocatoreId) {
        delete nuovo[index];
      } else {
        // Se il giocatore era già selezionato in un altro ruolo, lo rimuove da lì
        Object.keys(nuovo).forEach((k) => {
          if (nuovo[Number(k)] === giocatoreId) delete nuovo[Number(k)];
        });
        nuovo[index] = giocatoreId;
      }
      return nuovo;
    });
  };

  const getGiocatoreById = (id: string) => rosa.find((g) => g.id === id);

  // Suddivisione per linee di campo
  const por = posizioni.slice(0, 1);
  const dif = posizioni.filter((p) => p.etichetta.includes("D") || p.etichetta.includes("TS") || p.etichetta.includes("TD"));
  const cen = posizioni.filter((p) => p.etichetta.includes("CC") || p.etichetta.includes("MED") || p.etichetta.includes("MEZ") || p.etichetta.includes("CL") || p.etichetta === "E");
  const att = posizioni.filter((p) => p.etichetta.includes("ATT") || p.etichetta.includes("PC") || p.etichetta.includes("AD") || p.etichetta.includes("AS"));

  const renderLinea = (lineaPosizioni: typeof posizioni) => (
    <div className="flex justify-around items-center w-full my-2">
      {lineaPosizioni.map((pos) => {
        const index = posizioni.indexOf(pos);
        const selezionatoId = titolari[index];
        const gioc = selezionatoId ? getGiocatoreById(selezionatoId) : null;

        return (
          <div key={index} className="flex flex-col items-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-900/90 border-2 border-emerald-400/60 rounded-full flex flex-col justify-center items-center p-1 text-center shadow-md relative group hover:border-emerald-300 transition">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-tighter">
                {pos.etichetta}
              </span>
              <select
                value={selezionatoId || ""}
                onChange={(e) => impostaTitolare(index, e.target.value)}
                className="w-full bg-transparent text-[11px] font-semibold text-white text-center focus:outline-none cursor-pointer truncate px-1"
              >
                <option value="" className="bg-slate-900 text-slate-400">
                  + Scegli
                </option>
                {rosa.map((g) => (
                  <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                    {g.nome}
                  </option>
                ))}
              </select>
            </div>
            {gioc && (
              <span className="text-[10px] text-emerald-300 font-medium mt-1 max-w-[80px] truncate bg-slate-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
                {gioc.squadra}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl">
      {/* Header Controlli */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">⭐</span>
          <h2 className="text-xl font-bold text-amber-400 tracking-wide">La Mia Formazione</h2>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-semibold uppercase">Modulo:</label>
          <select
            value={modulo}
            onChange={(e) => setModulo(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-white text-sm font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="4-3-3">4-3-3</option>
            <option value="4-4-2">4-4-2</option>
            <option value="3-5-2">3-5-2</option>
          </select>

          <button
            onClick={onApriGestioneRosa}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition shadow-md flex items-center gap-1.5"
          >
            ✏️ Gestisci Rosa
          </button>
        </div>
      </div>

      {/* CAMPO DA GIOCO GREEN */}
      <div className="relative w-full bg-gradient-to-b from-emerald-800 via-emerald-700 to-emerald-900 border-4 border-slate-800 rounded-xl p-4 md:p-8 overflow-hidden shadow-2xl flex flex-col justify-between min-h-[420px]">
        {/* Righe Campo da Calcio */}
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white/20 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/20 rounded-full pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 border-b-2 border-x-2 border-white/20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-20 border-t-2 border-x-2 border-white/20 pointer-events-none" />

        {/* Reparti Tattici */}
        <div className="relative z-10 space-y-4">
          {renderLinea(att)}
          {renderLinea(cen)}
          {renderLinea(dif)}
          {renderLinea(por)}
        </div>
      </div>

      {/* Panchina */}
      <div className="mt-6 border-t border-slate-800 pt-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          🪑 Panchina ({rosa.filter((g) => !Object.values(titolari).includes(g.id)).length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {rosa.map((g) => {
            const inCampo = Object.values(titolari).includes(g.id);
            return (
              <span
                key={g.id}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition ${
                  inCampo
                    ? "bg-slate-950/50 text-slate-600 border-slate-800 line-through"
                    : "bg-slate-800 text-slate-200 border-slate-700 shadow-sm"
                }`}
              >
                {g.nome} ({g.squadra})
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}