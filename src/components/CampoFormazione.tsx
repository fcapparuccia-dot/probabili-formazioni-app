"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";

interface GiocatoreProbabile {
  id?: string;
  id_giocatore?: string;
  nome_completo: string;
  squadra: string;
  percentuale: number;
  stato: "titolare" | "panchina" | "indisponibile";
}

interface Props {
  rosa: GiocatoreProbabile[];
}

type SlotCampo = GiocatoreProbabile | null;

export default function CampoFormazione({ rosa: rosaIniziale }: Props) {
  const [schema, setSchema] = useState<string>("4-4-2");
  const [titolari, setTitolari] = useState<SlotCampo[]>(Array(11).fill(null));
  const [panchina, setPanchina] = useState<GiocatoreProbabile[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [giocatoreDaEliminare, setGiocatoreDaEliminare] = useState<GiocatoreProbabile | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const rosaNormalizzata = useMemo(() => {
    return (rosaIniziale || [])
      .map((g) => ({
        ...g,
        id: g.id || g.id_giocatore || "",
      }))
      .filter((g) => g.id !== "");
  }, [rosaIniziale]);

  useEffect(() => {
    if (!rosaNormalizzata || rosaNormalizzata.length === 0) return;

    const mappaRosa = new Map<string, GiocatoreProbabile>();
    rosaNormalizzata.forEach((g) => {
      if (g.id) mappaRosa.set(g.id, g);
      if (g.id_giocatore) mappaRosa.set(g.id_giocatore, g);
    });

    async function caricaFormazioneDaServer() {
      try {
        const res = await fetch(`/api/formazione?t=${Date.now()}`);

        if (res.ok) {
          const saved = await res.json();

          // Se il server restituisce uno schema salvato, lo impostiamo
          if (saved?.schema) {
            setSchema(saved.schema);
          }

          if (saved && (saved.titolari?.length > 0 || saved.panchina?.length > 0)) {
            const titolariRic: SlotCampo[] = (saved.titolari || []).map((id: string | null) =>
              id ? mappaRosa.get(id) || null : null
            );

            while (titolariRic.length < 11) {
              titolariRic.push(null);
            }

            const panchinaRic: GiocatoreProbabile[] = (saved.panchina || [])
              .map((id: string) => mappaRosa.get(id))
              .filter((g: any): g is GiocatoreProbabile => g !== undefined);

            const inseritiIds = new Set([
              ...titolariRic.filter(Boolean).map((g) => g!.id),
              ...panchinaRic.map((g) => g.id),
            ]);

            const rimanentiRosa = rosaNormalizzata.filter((g) => !inseritiIds.has(g.id));
            const panchinaFinale = [...panchinaRic, ...rimanentiRosa];

            setTitolari(titolariRic.slice(0, 11));
            setPanchina(panchinaFinale);
            setIsLoaded(true);
            return;
          }
        }
      } catch (e) {
        console.error("Errore recupero formazione dal server:", e);
      }

      const primi11: SlotCampo[] = rosaNormalizzata.slice(0, 11);
      while (primi11.length < 11) primi11.push(null);
      setTitolari(primi11);
      setPanchina(rosaNormalizzata.slice(11));
      setIsLoaded(true);
    }

    caricaFormazioneDaServer();
  }, [rosaNormalizzata]);

  const salvaFormazione = async (nuovoSchema: string, nuoviTitolari: SlotCampo[], nuovaPanchina: GiocatoreProbabile[]) => {
    setSchema(nuovoSchema);
    setTitolari(nuoviTitolari);
    setPanchina(nuovaPanchina);

    if (!isLoaded) return;

    setIsSaving(true);
    const titolariIds = nuoviTitolari.map((g) => (g ? g.id : null));
    const panchinaIds = nuovaPanchina.map((g) => g.id);

    try {
      await fetch("/api/formazione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: nuovoSchema,
          titolari: titolariIds,
          panchina: panchinaIds,
        }),
      });
    } catch (err) {
      console.error("Errore salvataggio server:", err);
    } finally {
      setTimeout(() => setIsSaving(false), 300);
    }
  };

  const getBadgeColor = (perc: number) => {
    if (perc >= 70) return "bg-emerald-500/30 text-emerald-300 border-emerald-500/50";
    if (perc >= 40) return "bg-amber-500/30 text-amber-300 border-amber-500/50";
    return "bg-rose-500/30 text-rose-300 border-rose-500/50";
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSlot = (targetIndex: number) => {
    if (!draggedId) return;

    const pIdx = panchina.findIndex((g) => g.id === draggedId);
    const tIdx = titolari.findIndex((g) => g?.id === draggedId);

    const nuoviTitolari = [...titolari];
    const nuovaPanchina = [...panchina];

    if (pIdx !== -1) {
      const giocatoreEstratto = nuovaPanchina.splice(pIdx, 1)[0];
      const giocatoreSostituito = nuoviTitolari[targetIndex];

      nuoviTitolari[targetIndex] = giocatoreEstratto;
      if (giocatoreSostituito) {
        nuovaPanchina.unshift(giocatoreSostituito);
      }
    } else if (tIdx !== -1 && tIdx !== targetIndex) {
      const temp = nuoviTitolari[targetIndex];
      nuoviTitolari[targetIndex] = nuoviTitolari[tIdx];
      nuoviTitolari[tIdx] = temp;
    }

    salvaFormazione(schema, nuoviTitolari, nuovaPanchina);
    setDraggedId(null);
  };

  const rimuoviTitolare = (index: number) => {
    const giocatore = titolari[index];
    if (!giocatore) return;

    const nuoviTitolari = [...titolari];
    nuoviTitolari[index] = null;
    const nuovaPanchina = [giocatore, ...panchina];

    salvaFormazione(schema, nuoviTitolari, nuovaPanchina);
    setSelectedSlotIndex(null);
  };

  const confermaEliminazione = () => {
    if (!giocatoreDaEliminare) return;
    const nuovaPanchina = panchina.filter((g) => g.id !== giocatoreDaEliminare.id);
    salvaFormazione(schema, titolari, nuovaPanchina);
    setGiocatoreDaEliminare(null);
  };

  const ripristinaRosaCompleta = () => {
    const salvatiIds = new Set(titolari.filter(Boolean).map((g) => g!.id));
    const nuovaPanchina = rosaNormalizzata.filter((g) => !salvatiIds.has(g.id));
    salvaFormazione(schema, titolari, nuovaPanchina);
  };

  const handleMouseDown = (index: number) => {
    timerRef.current = setTimeout(() => {
      setSelectedSlotIndex(index);
    }, 400);
  };

  const handleMouseUp = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleClickSlot = (index: number) => {
    if (titolari[index]) {
      setSelectedSlotIndex(selectedSlotIndex === index ? null : index);
    }
  };

  const schemiMap: Record<string, number[]> = {
    "4-4-2": [4, 4, 2],
    "4-3-3": [4, 3, 3],
    "3-5-2": [3, 5, 2],
    "4-2-3-1": [4, 2, 3, 1],
    "3-4-2-1": [3, 4, 2, 1],
  };

  const portiere = titolari[0] || null;
  const struttura = schemiMap[schema] || [4, 4, 2];

  const reparti: { slot: SlotCampo; realIndex: number }[][] = [];
  let currentIdx = 1;

  struttura.forEach((numGiocatori) => {
    const riga: { slot: SlotCampo; realIndex: number }[] = [];
    for (let i = 0; i < numGiocatori; i++) {
      riga.push({
        slot: titolari[currentIdx] || null,
        realIndex: currentIdx,
      });
      currentIdx++;
    }
    reparti.push(riga);
  });

  const haGiocatoriEliminati = panchina.length + titolari.filter(Boolean).length < rosaNormalizzata.length;

  return (
    <div className="space-y-4 relative" onClick={() => setSelectedSlotIndex(null)}>
      {giocatoreDaEliminare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setGiocatoreDaEliminare(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-rose-500/20 border border-rose-500/40 text-rose-400 rounded-full flex items-center justify-center mx-auto text-xl">
              🗑️
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Rimuovere il giocatore?</h4>
              <p className="text-sm text-slate-300 mt-1">
                Sei sicuro di voler rimuovere <strong className="text-amber-400">{giocatoreDaEliminare.nome_completo}</strong> dalla rosa?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setGiocatoreDaEliminare(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm py-2 px-3 rounded-lg border border-slate-700"
              >
                Annulla
              </button>
              <button
                onClick={confermaEliminazione}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm py-2 px-3 rounded-lg shadow"
              >
                Rimuovi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER CONTROLLI SCHEMA */}
      <div
        className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <label htmlFor="schema-select" className="font-bold text-slate-200 text-sm">
            Schema di Gioco:
          </label>
          <select
            id="schema-select"
            value={schema}
            onChange={(e) => salvaFormazione(e.target.value, titolari, panchina)}
            className="bg-slate-950 text-amber-400 font-bold border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 text-sm cursor-pointer"
          >
            <option value="4-4-2">4-4-2</option>
            <option value="4-3-3">4-3-3</option>
            <option value="3-5-2">3-5-2</option>
            <option value="4-2-3-1">4-2-3-1</option>
            <option value="3-4-2-1">3-4-2-1</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          {!isLoaded ? (
            <span className="text-slate-400">🔄 Caricamento...</span>
          ) : isSaving ? (
            <span className="text-amber-400 animate-pulse">⏳ Salvataggio in corso...</span>
          ) : (
            <span className="text-emerald-400">✓ Formazione Salvata</span>
          )}
        </div>
      </div>

      {/* CAMPO DA GIOCO E PANCHINA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div
          className="lg:col-span-8 bg-emerald-800 rounded-2xl p-4 border-2 border-emerald-600 shadow-2xl relative lg:sticky lg:top-4 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative w-full aspect-[4/3] bg-emerald-700/80 rounded-xl border-2 border-white/80 flex flex-col justify-between p-4 min-h-[480px]">
            {/* TRACCIATO CAMPO */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
              <div className="w-full h-1/2 border-b-2 border-white"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 border-2 border-white rounded-full"></div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 border-b-2 border-x-2 border-white"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-20 border-t-2 border-x-2 border-white"></div>
            </div>

            <div className="relative z-10 h-full flex flex-col justify-between items-center py-2">
              {reparti.slice().reverse().map((linea, rIdx) => (
                <div key={rIdx} className="w-full flex justify-around items-center px-4">
                  {linea.map(({ slot, realIndex }) => (
                    <SlotCampoGiocatore
                      key={realIndex}
                      giocatore={slot}
                      index={realIndex}
                      getBadgeColor={getBadgeColor}
                      isSelected={selectedSlotIndex === realIndex}
                      onMouseDown={() => handleMouseDown(realIndex)}
                      onMouseUp={handleMouseUp}
                      onClick={() => handleClickSlot(realIndex)}
                      onRimuovi={() => rimuoviTitolare(realIndex)}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropOnSlot(realIndex)}
                    />
                  ))}
                </div>
              ))}

              <div className="w-full flex justify-center">
                <SlotCampoGiocatore
                  giocatore={portiere}
                  index={0}
                  getBadgeColor={getBadgeColor}
                  isSelected={selectedSlotIndex === 0}
                  onMouseDown={() => handleMouseDown(0)}
                  onMouseUp={handleMouseUp}
                  onClick={() => handleClickSlot(0)}
                  onRimuovi={() => rimuoviTitolare(0)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnSlot(0)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ROSA E PANCHINA */}
        <div
          className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <span>Rosa / Panchina</span>
              <span className="text-xs font-normal text-slate-400">({panchina.length})</span>
            </h3>

            {haGiocatoriEliminati && (
              <button
                onClick={ripristinaRosaCompleta}
                className="text-[11px] bg-slate-800 text-amber-400 border border-amber-500/30 px-2 py-1 rounded hover:bg-slate-700"
              >
                🔄 Ripristina
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {panchina.map((giocatore) => (
              <div
                key={giocatore.id}
                draggable
                onDragStart={(e) => handleDragStart(e, giocatore.id!)}
                onDragOver={handleDragOver}
                className="flex items-center justify-between p-2.5 bg-slate-800/80 border border-slate-700/60 rounded-lg hover:border-amber-500 cursor-grab active:cursor-grabbing select-none"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getBadgeColor(giocatore.percentuale)}`}>
                    {giocatore.percentuale}%
                  </span>
                  <div>
                    <p className="font-bold text-sm text-white">{giocatore.nome_completo}</p>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">{giocatore.squadra}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs bg-slate-700/60 text-slate-400 font-semibold px-2 py-1 rounded">☰</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setGiocatoreDaEliminare(giocatore);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlotCampoGiocatore({
  giocatore,
  index,
  getBadgeColor,
  isSelected,
  onMouseDown,
  onMouseUp,
  onClick,
  onRimuovi,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  giocatore: SlotCampo;
  index: number;
  getBadgeColor: (p: number) => string;
  isSelected: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
  onClick: () => void;
  onRimuovi: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const isPortiere = index === 0;

  return (
    <div onDragOver={onDragOver} onDrop={onDrop} className="relative flex flex-col items-center select-none">
      {isSelected && giocatore && (
        <div
          className={`absolute z-50 bg-slate-900 border border-rose-500/80 rounded-lg p-1 ${
            isPortiere ? "-top-12" : "top-full mt-1"
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRimuovi();
            }}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-2.5 py-1.5 rounded flex items-center gap-1 whitespace-nowrap"
          >
            ❌ Rimuovi titolare
          </button>
        </div>
      )}

      {giocatore ? (
        <div
          draggable
          onDragStart={(e) => onDragStart(e, giocatore.id!)}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onClick={onClick}
          className="flex flex-col items-center cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
        >
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border mb-1 ${getBadgeColor(giocatore.percentuale)}`}>
            {giocatore.percentuale}%
          </span>
          <div className="w-11 h-11 bg-amber-400 text-slate-950 font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg text-xs">
            {giocatore.nome_completo.substring(0, 3).toUpperCase()}
          </div>
          <span className="bg-slate-950/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 border border-slate-700 max-w-[85px] truncate text-center">
            {giocatore.nome_completo}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-slate-400 mb-1 opacity-0">00%</span>
          <div className="w-11 h-11 bg-emerald-950/60 border-2 border-dashed border-emerald-400/60 rounded-full flex items-center justify-center text-emerald-300 font-extrabold text-lg">
            +
          </div>
          <span className="bg-slate-950/60 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded mt-1 border border-emerald-500/30">
            Libero
          </span>
        </div>
      )}
    </div>
  );
}