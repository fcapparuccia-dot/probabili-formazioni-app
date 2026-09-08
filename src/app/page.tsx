'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface FormazioneGiocatore {
  id: string;
  percentuale_titolarita: number;
  stato: string;
  giocatori: {
    nome_completo: string;
    ruolo?: string;
    squadre?: {
      nome: string;
    };
  };
}

export default function HomePage() {
  const [formazioni, setFormazioni] = useState<FormazioneGiocatore[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [messaggio, setMessaggio] = useState<string>('');

  // Funzione per caricare le formazioni salvate da Supabase
  const caricaFormazioni = async () => {
    try {
      const { data, error } = await supabase
        .from('probabili_formazioni')
        .select(`
          id,
          percentuale_titolarita,
          stato,
          giocatori (
            nome_completo,
            ruolo,
            squadre ( nome )
          )
        `);

      if (error) {
        console.error('Errore nel caricamento da Supabase:', error.message);
        return;
      }

      if (data) {
        setFormazioni(data as unknown as FormazioneGiocatore[]);
      }
    } catch (err) {
      console.error('Errore imprevisto:', err);
    }
  };

  useEffect(() => {
    caricaFormazioni();
  }, []);

  // Funzione attivata dal pulsante per lanciare scraper.py
  const avviaScraping = async () => {
    setLoading(true);
    setMessaggio('🚀 Esecuzione di scraper.py e aggiornamento database in corso...');

    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      const contentType = res.headers.get('content-type');

      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Il server non ha restituito una risposta JSON valida.');
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Errore durante l\'aggiornamento.');
      }

      setMessaggio('✅ Formazioni e percentuali aggiornate con successo!');
      await caricaFormazioni(); // Ricarica subito la lista aggiornata
    } catch (err: any) {
      setMessaggio(`❌ ${err.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setMessaggio(''), 6000);
    }
  };

  // Raggruppiamo i giocatori per squadra
  const squadreRaggruppate = formazioni.reduce((acc, f) => {
    const nomeSquadra = f.giocatori?.squadre?.nome || 'Altre';
    if (!acc[nomeSquadra]) acc[nomeSquadra] = [];
    acc[nomeSquadra].push(f);
    return acc;
  }, {} as Record<string, FormazioneGiocatore[]>);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Intestazione e Pulsante */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-amber-400">Probabili Formazioni Serie A</h1>
          <p className="text-slate-400 text-sm">Monitoraggio aggiornato con percentuali di titolarità</p>
        </div>

        <button
          onClick={avviaScraping}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-bold text-sm text-slate-950 transition-all shadow-lg flex items-center gap-2 ${
            loading ? 'bg-slate-600 cursor-not-allowed' : 'bg-amber-400 hover:bg-amber-300 active:scale-95'
          }`}
        >
          {loading ? '⏳ Aggiornamento in corso...' : '🚀 Aggiorna Probabili Formazioni'}
        </button>
      </div>

      {/* Messaggio di stato */}
      {messaggio && (
        <div className="max-w-7xl mx-auto mb-6 p-4 rounded-lg bg-slate-800 border border-slate-700 text-center font-medium">
          {messaggio}
        </div>
      )}

      {/* Sezione Squadre e Giocatori */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.keys(squadreRaggruppate).length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12">
            Nessuna formazione presente. Clicca su &quot;Aggiorna Probabili Formazioni&quot; per avviare lo scraper.
          </div>
        ) : (
          Object.entries(squadreRaggruppate).map(([squadra, giocatori]) => (
            <div key={squadra} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
              <h2 className="text-xl font-bold text-amber-400 border-b border-slate-800 pb-2 mb-4 uppercase tracking-wider">
                {squadra}
              </h2>
              <ul className="space-y-2">
                {giocatori.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-800/60 hover:bg-slate-800 transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">{item.giocatori?.nome_completo}</span>
                      {item.giocatori?.ruolo && (
                        <span className="ml-2 text-xs text-slate-400 uppercase">({item.giocatori.ruolo})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded font-bold ${
                          item.percentuale_titolarita >= 70
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : item.percentuale_titolarita >= 50
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {item.percentuale_titolarita}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}