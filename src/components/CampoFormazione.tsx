"use client";

import { useState, useEffect } from "react";

export interface GiocatoreRosa {
  id: string;
  nome: string;
  squadra: string;
  percentuale: number;
  stato: string;
}

interface Props {
  rosa: GiocatoreRosa[];
  formazioneDB: { giocatore_id: string; posizione: string }[];
  moduloDB?: string;
  onApriGestioneRosa: () => void;
  onSalvaPosizione: (giocatoreId: string, posizione: string) => void;
  onSalvaModulo: (modulo: string) => void;
}

const SCHEMI: Record<string, { id: string; etichetta: string; linea: "POR" | "DIF" | "CEN" | "ATT" }[]> = {
  "4-4-2": [
    { id: "POR", etichetta: "POR", linea: "POR" },
    { id: "TD", etichetta: "TD", linea: "DIF" },
    { id: "DC1", etichetta: "DC", linea: "DIF" },
    { id: "DC2", etichetta: "DC", linea: "DIF" },
    { id: "TS", etichetta: "TS", linea: "DIF" },
    { id: "CLD", etichetta: "CLD", linea: "CEN" },
    { id: "CC1", etichetta: "CC", linea: "CEN" },
    { id: "CC2", etichetta: "CC", linea: "CEN" },
    { id: "CLS", etichetta: "CLS", linea: "CEN" },
    { id: "ATT1", etichetta: "ATT", linea: "ATT" },
    { id: "ATT2", etichetta: "ATT", linea: "ATT" },
  ],
  "4-3-3": [
    { id: "POR", etichetta: "POR", linea: "POR" },
    { id: "TD", etichetta: "TD", linea: "DIF" },
    { id: "DC1", etichetta: "DC", linea: "DIF" },
    { id: "DC2", etichetta: "DC", linea: "DIF" },
    { id: "TS", etichetta: "TS", linea: "DIF" },
    { id: "MEZ1", etichetta: "MEZ", linea: "CEN" },
    { id: "MED", etichetta: "MED", linea: "CEN" },
    { id: "MEZ2", etichetta: "MEZ", linea: "CEN" },
    { id: "AD", etichetta: "AD", linea: "ATT" },
    { id: "PC", etichetta: "PC", linea: "ATT" },
    { id: "AS", etichetta: "AS", linea: "ATT" },
  ],
  "4-5-1": [
    { id: "POR", etichetta: "POR", linea: "POR" },
    { id: "TD", etichetta: "TD", linea: "DIF" },
    { id: "DC1", etichetta: "DC", linea: "DIF" },
    { id: "DC2", etichetta: "DC", linea: "DIF" },
    { id: "TS", etichetta: "TS", linea: "DIF" },
    { id: "CLD", etichetta: "CLD", linea: "CEN" },
    { id: "CC1", etichetta: "CC", linea: "CEN" },
    { id: "MED", etichetta: "MED", linea: "CEN" },
    { id: "CC2", etichetta: "CC", linea: "CEN" },
    { id: "CLS", etichetta: "CLS", linea: "CEN" },
    { id: "PC", etichetta: "PC", linea: "ATT" },
  ],
  "3-5-2": [
    { id: "POR", etichetta: "POR", linea: "POR" },
    { id: "DC1", etichetta: "DC", linea: "DIF" },
    { id: "DC2", etichetta: "DC", linea: "DIF" },
    { id: "DC3", etichetta: "DC", linea: "DIF" },
    { id: "ED", etichetta: "E", linea: "CEN" },
    { id: "CC1", etichetta: "CC", linea: "CEN" },
    { id: "MED", etichetta: "MED", linea: "CEN" },
    { id: "CC2", etichetta: "CC", linea: "CEN" },
    { id: "ES", etichetta: "E", linea: "CEN" },
    { id: "ATT1", etichetta: "ATT", linea: "ATT" },
    { id: "ATT2", etichetta: "ATT", linea: "ATT" },
  ],
  "3-4-3": [
    { id: "POR", etichetta: "POR", linea: "POR" },
    { id: "DC1", etichetta: "DC", linea: "DIF" },
    { id: "DC2", etichetta: "DC", linea: "DIF" },
    { id: "DC3", etichetta: "DC", linea: "DIF" },
    { id: "ED", etichetta: "E", linea: "CEN" },
    { id: "CC1", etichetta: "CC", linea: "CEN" },
    { id: "CC2", etichetta: "CC", linea: "CEN" },
    { id: "ES", etichetta: "E", linea: "CEN" },
    { id: "AD", etichetta: "AD", linea: "ATT" },
    { id: "PC", etichetta: "PC", linea: "ATT" },
    { id: "AS", etichetta: "AS", linea: "ATT" },
  ],
  "5-3-2": [
    { id: "POR", etichetta: "POR", linea: "POR" },
    { id: "DD", etichetta: "DD", linea: "DIF" },
    { id: "DC1", etichetta: "DC", linea: "DIF" },
    { id: "DC2", etichetta: "DC", linea: "DIF" },
    { id: "DC3", etichetta: "DC", linea: "DIF" },
    { id: "DS", etichetta: "DS", linea: "DIF" },
    { id: "CC1", etichetta: "CC", linea: "CEN" },
    { id: "MED", etichetta: "MED", linea: "CEN" },
    { id: "CC2", etichetta: "CC", linea: "CEN" },
    { id: "ATT1", etichetta: "ATT", linea: "ATT" },
    { id: "ATT2", etichetta: "ATT", linea: "ATT" },
  ],
  "5-4-1": [
    { id: "POR", etichetta: "POR", linea: "POR" },
    { id: "DD", etichetta: "DD", linea: "DIF" },
    { id: "DC1", etichetta: "DC", linea: "DIF" },
    { id: "DC2", etichetta: "DC", linea: "DIF" },
    { id: "DC3", etichetta: "DC", linea: "DIF" },
    { id: "DS", etichetta: "DS", linea: "DIF" },
    { id: "CLD", etichetta: "CLD", linea: "CEN" },
    { id: "CC1", etichetta: "CC", linea: "CEN" },
    { id: "CC2", etichetta: "CC", linea: "CEN" },
    { id: "CLS", etichetta: "CLS", linea: "CEN" },
    { id: "PC", etichetta: "PC", linea: "ATT" },
  ],
};

const getColorePercentuale = (perc: number) => {
  if (perc >= 70) {
    return "bg-emerald-950/90 text-emerald-400 border-emerald-500/50";
  }
  if (perc >= 45) {
    return "bg-amber-950/90 text-amber-400 border-amber-500/50";
  }
  return "bg-rose-950/90 text-rose-400 border-rose-500/50";
};

export default function CampoFormazione({
  rosa,
  formazioneDB,
  moduloDB = "4-4-2",
  onApriGestioneRosa,
  onSalvaPosizione,
  onSalvaModulo,
}: Props) {
  const [modulo, setModulo] = useState<string>(moduloDB);
  const [titolari, setTitolari] = useState<Record<string, string>>({});

  useEffect(() => {
    if (moduloDB) {
      setModulo(moduloDB);
    }
  }, [moduloDB]);

  useEffect(() => {
    const nuovaMappa: Record<string, string> = {};
    formazioneDB.forEach((item) => {
      if (item.posizione && item.posizione !== "PANCHINA" && !item.posizione.startsWith("SCHEMA_")) {
        nuovaMappa[item.posizione] = item.giocatore_id;
      }
    });
    setTitolari(nuovaMappa);
  }, [formazioneDB]);

  const handleCambioModulo = (nuovoModulo: string) => {
    setModulo(nuovoModulo);
    onSalvaModulo(nuovoModulo);

    const nuovePosizioni = SCHEMI[nuovoModulo] || SCHEMI["4-4-2"];
    const giocatoriSchierati = Object.values(titolari);
    const nuovaMappa: Record<string, string> = {};

    nuovePosizioni.forEach((pos, index) => {
      if (giocatoriSchierati[index]) {
        nuovaMappa[pos.id] = giocatoriSchierati[index];
        onSalvaPosizione(giocatoriSchierati[index], pos.id);
      }
    });

    giocatoriSchierati.slice(nuovePosizioni.length).forEach((gId) => {
      onSalvaPosizione(gId, "PANCHINA");
    });

    setTitolari(nuovaMappa);
  };

  const posizioni = SCHEMI[modulo] || SCHEMI["4-4-2"];

  const assegnaGiocatoreAPosizione = (posId: string, giocatoreId: string) => {
    const nuovaMappa = { ...titolari };

    Object.keys(nuovaMappa).forEach((k) => {
      if (nuovaMappa[k] === giocatoreId) {
        delete nuovaMappa[k];
      }
    });

    if (giocatoreId) {
      nuovaMappa[posId] = giocatoreId;
      onSalvaPosizione(giocatoreId, posId);
    } else {
      const gRimosso = titolari[posId];
      delete nuovaMappa[posId];
      if (gRimosso) onSalvaPosizione(gRimosso, "PANCHINA");
    }

    setTitolari(nuovaMappa);
  };

  const handleDragStart = (e: React.DragEvent, giocatoreId: string) => {
    e.dataTransfer.setData("text/plain", giocatoreId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, posId: string) => {
    e.preventDefault();
    const giocatoreId = e.dataTransfer.getData("text/plain");
    if (giocatoreId) {
      assegnaGiocatoreAPosizione(posId, giocatoreId);
    }
  };

  const getGiocatoreById = (id: string) => rosa.find((g) => g.id === id);

  const por = posizioni.filter((p) => p.linea === "POR");
  const dif = posizioni.filter((p) => p.linea === "DIF");
  const cen = posizioni.filter((p) => p.linea === "CEN");
  const att = posizioni.filter((p) => p.linea === "ATT");

  const renderLinea = (lineaPosizioni: typeof posizioni) => (
    <div className="flex justify-around items-center w-full my-1 sm:my-2 px-0.5">
      {lineaPosizioni.map((pos) => {
        const selezionatoId = titolari[pos.id];
        const gioc = selezionatoId ? getGiocatoreById(selezionatoId) : null;

        return (
          <div
            key={pos.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, pos.id)}
            className="flex flex-col items-center group cursor-pointer max-w-[24%] sm:max-w-none"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-slate-900/90 border-2 border-emerald-400/80 rounded-full flex flex-col justify-center items-center p-0.5 sm:p-1 text-center shadow-lg relative transition hover:scale-105 hover:border-emerald-300">
              <span className="text-[12px] sm:text-[13px] font-extrabold text-amber-400 uppercase tracking-tighter">
                {pos.etichetta}
              </span>

              <select
                value={selezionatoId || ""}
                onChange={(e) => assegnaGiocatoreAPosizione(pos.id, e.target.value)}
                className="w-full bg-transparent text-[13px] sm:text-[14px] font-bold text-white text-center focus:outline-none cursor-pointer truncate px-0.5"
              >
                <option value="" className="bg-slate-900 text-slate-400">
                  + Scegli
                </option>
                {rosa.map((g) => (
                  <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                    {g.nome} ({g.percentuale}%)
                  </option>
                ))}
              </select>
            </div>

            {gioc && (
              <div className="mt-1 flex flex-col items-center max-w-[95px] sm:max-w-[125px]">
                <span className="text-[13px] sm:text-[14px] font-extrabold text-white bg-slate-950/95 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-500/50 shadow truncate w-full text-center">
                  {gioc.nome}
                </span>
                <span className={`text-[11px] sm:text-[12px] font-extrabold px-1.5 py-0.5 rounded border mt-0.5 ${getColorePercentuale(gioc.percentuale)}`}>
                  {gioc.percentuale}%
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 sm:p-4 md:p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4 sm:mb-6 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">⭐</span>
          <h2 className="text-lg sm:text-xl font-bold text-amber-400 tracking-wide">La Mia Formazione</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <label className="text-xs text-slate-400 font-semibold uppercase">Modulo:</label>
          <select
            value={modulo}
            onChange={(e) => handleCambioModulo(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="4-3-3">4-3-3</option>
            <option value="4-4-2">4-4-2</option>
            <option value="4-5-1">4-5-1</option>
            <option value="3-5-2">3-5-2</option>
            <option value="3-4-3">3-4-3</option>
            <option value="5-3-2">5-3-2</option>
            <option value="5-4-1">5-4-1</option>
          </select>

          <button
            onClick={onApriGestioneRosa}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg transition shadow-md"
          >
            ✏️ Gestisci Rosa
          </button>
        </div>
      </div>

      <div className="relative w-full bg-gradient-to-b from-emerald-800 via-emerald-700 to-emerald-900 border-2 sm:border-4 border-slate-800 rounded-xl p-2 sm:p-4 md:p-6 overflow-hidden shadow-2xl flex flex-col justify-between min-h-[420px] sm:min-h-[440px]">
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white/20 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-32 sm:h-32 border-2 border-white/20 rounded-full pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 sm:w-48 h-16 sm:h-20 border-b-2 border-x-2 border-white/20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 sm:w-48 h-16 sm:h-20 border-t-2 border-x-2 border-white/20 pointer-events-none" />

        <div className="relative z-10 space-y-1 sm:space-y-2">
          {renderLinea(att)}
          {renderLinea(cen)}
          {renderLinea(dif)}
          {renderLinea(por)}
        </div>
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          🪑 Panchina (Trascina il giocatore nel ruolo sul campo)
        </h3>
        <div className="flex flex-wrap gap-2">
          {rosa.map((g) => {
            const inCampo = Object.values(titolari).includes(g.id);
            return (
              <div
                key={g.id}
                draggable={!inCampo}
                onDragStart={(e) => handleDragStart(e, g.id)}
                className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-bold border transition flex items-center gap-2 ${
                  inCampo
                    ? "bg-slate-950/40 text-slate-600 border-slate-800 line-through cursor-not-allowed"
                    : "bg-slate-800 text-white border-slate-700 shadow cursor-grab hover:border-amber-500"
                }`}
              >
                <span>{g.nome} ({g.squadra})</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getColorePercentuale(g.percentuale)}`}>
                  {g.percentuale}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}