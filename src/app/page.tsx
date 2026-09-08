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
  const [loadingScrape, setLoadingScrape] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [messaggio, setMessaggio] = useState<string>('');

  // 1. Funzione per leggere i giocatori salvati su Supabase
  const caricaFormazioni = async (silent = false) => {
    if (!silent) {
      setLoadingData(true);
      setMessaggio('📥 Caricamento dati da Supabase in corso...');
    }

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
        throw new Error(error.message);
      }

      if (data) {
        setFormazioni(data as unknown as FormazioneGiocatore[]);
        if (!silent) {
          setMessaggio(`✅ Caricati ${data.length} giocatori con successo!`);
        }
      }
    } catch (err: any) {
      if (!silent) {
        setMessaggio(`❌ Errore caricamento: ${err.message}`);
      }
    } finally {
      if (!silent) {
        setLoadingData(false);
        setTimeout(() => setMessaggio(''), 5000);
      }
    }
  };

  useEffect(() => {
    caricaFormazioni();
  }, []);

  // 2. Funzione per lanciare lo scraper con Polling attivo su Supabase
  const avviaScraping = async () => {
    setLoadingScrape(true);
    setMessaggio('🚀 Avvio di GitHub Actions in corso...');

    try {
      // Conta i record attuali prima di lanciare lo scraper
      const { count: initialCount } = await supabase
        .from('probabili_formazioni')
        .select('*', { count: 'exact', head: true });

      const res = await fetch('/api/scrape', { method: 'POST' });
      const contentType = res.headers.get('content-type');

      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Ambiente non compatibile. Esegui lo scraper da ambiente locale.');
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Errore durante l\'avvio dello scraping.');
      }

      setMessaggio('⏳ Scraper avviato su GitHub Actions. Attendi l\'elaborazione dei dati...');

      // Pausa iniziale di 15 secondi per dare tempo a GitHub di preparare il runner
      await new Promise((resolve) => setTimeout(resolve, 15000));

      // Inizio del polling: controlla ogni 4 secondi se il database si è aggiornato
      let tentativi = 0;
      const maxTentativi = 12; // Limite massimo: circa 48 secondi di polling dopo la pausa
      let completato = false;

      while (tentativi < maxTentativi && !completato) {
        tentativi++;
        setMessaggio(`⏳ Verifica aggiornamento dati su Supabase (tentativo ${tentativi}/${maxTentativi})...`);

        const { count: currentCount } = await supabase
          .from('probabili_formazioni')
          .select('*', { count: 'exact', head: true });

        // Se i record sono variati oppure se si tratta di un aggiornamento di dati esistenti
        if (currentCount !== null && currentCount !== initialCount) {
          completato = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 4000));
      }

      // Ricarica automaticamente la lista a schermo
      await caricaFormazioni(true);
      setMessaggio('✅ Scraping e aggiornamento completati con successo!');

    } catch (err: any) {
      setMessaggio(`❌ ${err.message}`);
    } finally {
      setLoadingScrape(false);
      setTimeout(() => setMessaggio(''), 7000);
    }
  };

  // Raggruppamento giocatori per squadra
  const squadreRaggruppate = formazioni.reduce((acc, f) => {
    const nomeSquadra = f.giocatori?.squadre?.nome || 'Altre';
    if (!acc[nomeSquadra]) acc[nomeSquadra] = [];
    acc[nomeSquadra].push(f);
    return acc;
  }, {} as Record<string, FormazioneGiocatore[]>);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Intestazione e Pulsanti */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-amber-400">Probabili Formazioni Serie A</h1>
          <p className="text-slate-400 text-sm">Pannello di controllo e visualizzazione percentuali</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Pulsante 1: Lancia Scraper */}
          <button
            onClick={avviaScraping}
            disabled={loadingScrape}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm text-slate-950 transition-all shadow-md flex items-center gap-2 ${
              loadingScrape ? 'bg-slate-600 cursor-not-allowed' : 'bg-amber-400 hover:bg-amber-300 active:scale-95'
            }`}
          >
            {loadingScrape ? '⏳ Elaborazione in corso...' : '🐍 Lancia scraper.py'}
          </button>

          {/* Pulsante 2: Mostra / Ricarica Giocatori */}
          <button
            onClick={() => caricaFormazioni()}
            disabled={loadingData}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm text-white transition-all shadow-md border border-slate-700 flex items-center gap-2 ${
              loadingData ? 'bg-slate-800 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 active:scale-95'
            }`}
          >
            {loadingData ? '⏳ Caricamento...' : '📋 Mostra Giocatori'}
          </button>
        </div>
      </div>

      {/* Messaggio di stato */}
      {messaggio && (
        <div className="max-w-7xl mx-auto mb-6 p-4 rounded-lg bg-slate-900 border border-slate-800 text-center font-medium text-amber-300 transition-all">
          {messaggio}
        </div>
      )}

      {/* Griglia Squadre e Giocatori */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.keys(squadreRaggruppate).length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12">
            Nessun giocatore da mostrare. Clicca su &quot;Mostra Giocatori&quot; per caricare i dati.
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