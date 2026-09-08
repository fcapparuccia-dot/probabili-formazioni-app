'use client';

import { useState } from 'react';

interface PitchBuilderProps {
  rosa: { id: string; nome_completo: string; squadra: string }[];
}

const MODULI = ['3-4-3', '3-5-2', '5-2-3', '5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3'];

export default function PitchBuilder({ rosa }: PitchBuilderProps) {
  const [modulo, setModulo] = useState<string>('3-4-3');
  const [titolari, setTitolari] = useState<Record<string, string>>({});
  const [panchina, setPanchina] = useState<{ P: string[]; D: string[]; C: string[]; A: string[] }>({
    P: [''],
    D: ['', '', ''],
    C: ['', '', '', ''],
    A: ['', '', '', ''],
  });

  const [dif, cen, att] = modulo.split('-').map(Number);

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
      <div className="flex justify-around items-center w-full my-2">
        {Array.from({ length: conteggio }).map((_, i) => {
          const slotId = `${ruolo}_${i}`;
          const valore = titolari[slotId] || '';
          return (
            <div key={slotId} className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-amber-400 flex items-center justify-center text-xs font-bold shadow-md">
                ⚽
              </div>
              <select
                value={valore}
                onChange={(e) => handleSelectTitolare(ruolo, i, e.target.value)}
                className="mt-1 text-xs bg-slate-900/90 text-white border border-slate-700 rounded px-1 py-0.5 max-w-[100px] truncate focus:outline-none focus:border-amber-400"
              >
                <option value="">Seleziona...</option>
                {rosa.map((g) => (
                  <option key={g.id} value={g.nome_completo}>
                    {g.nome_completo}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
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
        {/* Linee del campo */}
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-300/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-emerald-300/30 rounded-full" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 border-b-2 border-x-2 border-emerald-300/30" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-16 border-t-2 border-x-2 border-emerald-300/30" />

        {/* Portiere */}
        <div className="relative z-10">{renderLinea('P', 1)}</div>

        {/* Difesa */}
        <div className="relative z-10">{renderLinea('D', dif)}</div>

        {/* Centrocampo */}
        <div className="relative z-10">{renderLinea('C', cen)}</div>

        {/* Attacco */}
        <div className="relative z-10">{renderLinea('A', att)}</div>
      </div>

      {/* SOSTITUTI / PANCHINA */}
      <div className="mt-8 border-t border-slate-700 pt-6">
        <h3 className="text-md font-bold text-slate-200 mb-4">Sostituti Panchina (1 P, 3 D, 4 C, 4 A)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Portiere Panchina */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
            <span className="text-xs font-bold text-amber-400 block mb-2">Portiere (1)</span>
            <select
              value={panchina.P[0]}
              onChange={(e) => handleSelectPanchina('P', 0, e.target.value)}
              className="w-full text-xs bg-slate-900 text-white border border-slate-700 rounded p-1.5"
            >
              <option value="">Seleziona P...</option>
              {rosa.map((g) => (
                <option key={g.id} value={g.nome_completo}>{g.nome_completo}</option>
              ))}
            </select>
          </div>

          {/* Difensori Panchina */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
            <span className="text-xs font-bold text-amber-400 block mb-2">Difensori (3)</span>
            {panchina.D.map((val, idx) => (
              <select
                key={idx}
                value={val}
                onChange={(e) => handleSelectPanchina('D', idx, e.target.value)}
                className="w-full text-xs bg-slate-900 text-white border border-slate-700 rounded p-1.5 mb-1.5"
              >
                <option value="">Seleziona D{idx + 1}...</option>
                {rosa.map((g) => (
                  <option key={g.id} value={g.nome_completo}>{g.nome_completo}</option>
                ))}
              </select>
            ))}
          </div>

          {/* Centrocampisti Panchina */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
            <span className="text-xs font-bold text-amber-400 block mb-2">Centrocampisti (4)</span>
            {panchina.C.map((val, idx) => (
              <select
                key={idx}
                value={val}
                onChange={(e) => handleSelectPanchina('C', idx, e.target.value)}
                className="w-full text-xs bg-slate-900 text-white border border-slate-700 rounded p-1.5 mb-1.5"
              >
                <option value="">Seleziona C{idx + 1}...</option>
                {rosa.map((g) => (
                  <option key={g.id} value={g.nome_completo}>{g.nome_completo}</option>
                ))}
              </select>
            ))}
          </div>

          {/* Attaccanti Panchina */}
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
            <span className="text-xs font-bold text-amber-400 block mb-2">Attaccanti (4)</span>
            {panchina.A.map((val, idx) => (
              <select
                key={idx}
                value={val}
                onChange={(e) => handleSelectPanchina('A', idx, e.target.value)}
                className="w-full text-xs bg-slate-900 text-white border border-slate-700 rounded p-1.5 mb-1.5"
              >
                <option value="">Seleziona A{idx + 1}...</option>
                {rosa.map((g) => (
                  <option key={g.id} value={g.nome_completo}>{g.nome_completo}</option>
                ))}
              </select>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}