'use client';

import { useState } from 'react';

interface PitchBuilderProps {
  rosa: { id: string; nome_completo: string; squadra: string }[];
  squadreMappa: Record<string, { nome: string; percentuale: number }[]>;
}

const MODULI = ['3-4-3', '3-5-2', '5-2-3', '5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3'];

export default function PitchBuilder({ rosa, squadreMappa }: PitchBuilderProps) {
  const [modulo, setModulo] = useState<string>('3-4-3');
  const [titolari, setTitolari] = useState<Record<string, string>>({});
  const [panchina, setPanchina] = useState<{ P: string[]; D: string[]; C: string[]; A: string[] }>({
    P: [''],
    D: ['', '', ''],
    C: ['', '', '', ''],
    A: ['', '', '', ''],
  });

  const [dif, cen, att] = modulo.split('-').map(Number);

  // Trova la percentuale di titolarità per un giocatore
  const getPercentuale = (nomeGiocatore: string, squadra: string) => {
    if (!nomeGiocatore) return null;
    const listaSquadra = squadreMappa[squadra] || [];
    const trovato = listaSquadra.find(
      (g) => g.nome.toLowerCase() === nomeGiocatore.toLowerCase()
    );
    return trovato ? trovato.percentuale : null;
  };

  const handleSelectTitolare = (ruolo: string, index: number, valore: string) => {
    setTitolari((prev) => ({ ...prev, [`${ruolo}_${index}`]: valore }));
  };

  const handleSelectPanchina = (ruolo: 'P' | 'D' | 'C' | 'A', index: number, valore: string) => {
    setPanchina((prev) => {
      const nuovaLizza = [...prev[ruolo]];
      nuovaLizza[index] = valore;
      return { ...prev, [ruolo]: nuovaLizza };
    });
  };

  const renderLinea = (ruolo: string, conteggio: number) => {
    return (
      <div className="flex justify-around items-center w-full my-1">
        {Array.from({ length: conteggio }).map((_, i) => {
          const slotId = `${ruolo}_${i}`;
          const valore = titolari[slotId] || '';
          const giocatoreObj = rosa.find((g) => g.nome_completo === valore);
          const perc = giocatoreObj ? getPercentuale(giocatoreObj.nome_completo, giocatoreObj.squadra) : null;

          return (
            <div key={slotId} className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-amber-400 flex items-center justify-center text-xs font-bold shadow-md">
                ⚽
              </div>
              <select
                value={valore}
                onChange={(e) => handleSelectTitolare(ruolo, i, e.target.value)}
                className="mt-1 text-[11px] bg-slate-900/90 text-white border border-slate-700 rounded px-1 py-0.5 max-w-[110px] truncate focus:outline-none focus:border-amber-400"
              >
                <option value="">Seleziona...</option>
                {rosa.map((g) => {
                  const p = getPercentuale(g.nome_completo, g.squadra);
                  const txtPerc = p !== null ? ` (${p}%)` : ' (N/D)';
                  return (
                    <option key={g.id} value={g.nome_completo}>
                      {g.nome_completo}{txtPerc}
                    </option>
                  );
                })}
              </select>
              {perc !== null && (
                <span className="text-[10px] font-bold text-emerald-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30 mt-0.5">
                  {perc}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderPanchinaSelect = (ruolo: 'P' | 'D' | 'C' | 'A', index: number, placeholder: string) => {
    const valore = panchina[ruolo][index] || '';
    const giocatoreObj = rosa.find((g) => g.nome_completo === valore);
    const perc = giocatoreObj ? getPercentuale(giocatoreObj.nome_completo, giocatoreObj.squadra) : null;

    return (
      <div className="mb-2">
        <select
          value={valore}
          onChange={(e) => handleSelectPanchina(ruolo, index, e.target.value)}
          className="w-full text-xs bg-slate-900 text-white border border-slate-700 rounded p-1.5"
        >
          <option value="">{placeholder}</option>
          {rosa.map((g) => {
            const p = getPercentuale(g.nome_completo, g.squadra);
            const txtPerc = p !== null ? ` (${p}%)` : ' (N/D)';
            return (
              <option key={g.id} value={g.nome_completo}>
                {g.nome_completo}{txtPerc}
              </option>
            );
          })}
        </select>
        {perc !== null && (
          <span className="text-[10px] font-semibold text-emerald-400 ml-1">
            Titolarità: {perc}%
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl mb-10 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold text-amber-400">Campo & Formazione</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-300 font-semibold">Modulo:</label>
          <select
            value={modulo}
            onChange={(e) => setModulo(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-amber-400 font-bold text-sm rounded-lg px-3 py-1.5 focus:outline-none"
          >
            {MODULI.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CAMPO DA CALCIO VISUALE */}
      <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-emerald-700 border-4 border-emerald-300/40 rounded-xl p-4 flex flex-col justify-between overflow-hidden shadow-2xl">
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-300/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-emerald-300/30 rounded-full" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 border-b-2 border-x-2 border-emerald-300/30" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-16 border-t-2 border-x-2 border-emerald-300/30" />

        <div className="relative z-10">{renderLinea('P', 1)}</div>
        <div className="relative z-10">{renderLinea('D', dif)}</div>
        <div className="relative z-10">{renderLinea('C', cen)}</div>
        <div className="relative z-10">{renderLinea('A', att)}</div>
      </div>

      {/* SOSTITUTI / PANCHINA */}
      <div className="mt-8 border-t border-slate-700 pt-6">
        <h3 className="text-md font-bold text-slate-200 mb-4">Sostituti Panchina (1 P, 3 D, 4 C, 4 A)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
            <span className="text-xs font-bold text-amber-400 block mb-2">Portiere (1)</span>
            {renderPanchinaSelect('P', 0, 'Seleziona P...')}
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
            <span className="text-xs font-bold text-amber-400 block mb-2">Difensori (3)</span>
            {panchina.D.map((_, idx) => renderPanchinaSelect('D', idx, `Seleziona D${idx + 1}...`))}
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
            <span className="text-xs font-bold text-amber-400 block mb-2">Centrocampisti (4)</span>
            {panchina.C.map((_, idx) => renderPanchinaSelect('C', idx, `Seleziona C${idx + 1}...`))}
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
            <span className="text-xs font-bold text-amber-400 block mb-2">Attaccanti (4)</span>
            {panchina.A.map((_, idx) => renderPanchinaSelect('A', idx, `Seleziona A${idx + 1}...`))}
          </div>
        </div>
      </div>
    </div>
  );
}