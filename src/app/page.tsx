'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface GiocatoreFormazione {
  nome: string;
  ruolo: string;
  percentuale: number;
  stato: string;
}

interface GiocatoreOption {
  id: string;
  nome_completo: string;
  squadra: string;
}

const STORAGE_KEY = 'mia_rosa_fantacalcio_v1';

export default function HomePage() {
  const [squadreMappa, setSquadreMappa] = useState<Record<string, GiocatoreFormazione[]>>({});
  const [tuttiGiocatori, setTuttiGiocatori] = useState<GiocatoreOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [messaggio, setMessaggio] = useState<string>('');

  // Ricerca e completamento automatico
  const [queryRicerca, setQueryRicerca] = useState<string>('');
  const [suggerimenti, setSuggerimenti] = useState<GiocatoreOption[]>([]);
  const [selezionatiTemp, setSelezionatiTemp] = useState<GiocatoreOption[]>([]);
  const [mostraDropdown, setMostraDropdown] = useState<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Rosa utente salvata in localStorage
  const [miaRosa, setMiaRosa] = useState<GiocatoreOption[]>([]);
  const [risultatoVerifica, setRisultatoVerifica] = useState<{
    totale: number;
    titolariCount: number;
    dettagli: { nome: string; squadra: string; eTitolare: boolean }[];
  } | null>(null);

  // 1. Carica la rosa dal localStorage all'avvio
  useEffect(() => {
    const rosaSalvata = localStorage.getItem(STORAGE_KEY);
    if (rosaSalvata) {
      try {
        setMiaRosa(JSON.parse(rosaSalvata));
      } catch (e) {
        console.error('Errore durante il recupero della rosa salvata', e);
      }
    }
  }, []);

  // 2. Salva la rosa nel localStorage ogni volta che viene modificata
  const aggiornaESalvaRosa = (nuovaRosa: GiocatoreOption[]) => {
    setMiaRosa(nuovaRosa);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nuovaRosa));
  };

  // Caricamento dati da Supabase
  const caricaFormazioni = async () => {
    setLoading(true);
    const { data: probabiliFormazioni, error } = await supabase
      .from('probabili_formazioni')
      .select(`
        id,
        percentuale_titolarita,
        stato,
        giocatori (
          id,
          nome_completo,
          ruolo,
          squadre (
            nome
          )
        )
      `);

    if (error) {
      console.error('Errore Supabase:', error.message);
      setLoading(false);
      return;
    }

    const mappa: Record<string, GiocatoreFormazione[]> = {};
    const listaCompleta: GiocatoreOption[] = [];

    probabiliFormazioni?.forEach((item: any) => {
      const nomeSquadra = item.giocatori?.squadre?.nome || 'NON DEFINITA';
      const nomeGiocatore = item.giocatori?.nome_completo;

      if (!mappa[nomeSquadra]) {
        mappa[nomeSquadra] = [];
      }
      mappa[nomeSquadra].push({
        nome: nomeGiocatore,
        ruolo: item.giocatori?.ruolo || 'N/D',
        percentuale: item.percentuale_titolarita,
        stato: item.stato,
      });

      if (item.giocatori) {
        listaCompleta.push({
          id: item.giocatori.id,
          nome_completo: nomeGiocatore,
          squadra: nomeSquadra,
        });
      }
    });

    listaCompleta.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));

    setSquadreMappa(mappa);
    setTuttiGiocatori(listaCompleta);
    setLoading(false);
  };

  // Funzione che esegue lo scraper Python via API e poi aggiorna l'interfaccia
  const avviaScrapingEAggiorna = async () => {
    setIsScraping(true);
    setMessaggio('🐍 Esecuzione di scraper.py in corso...');

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Errore durante l\'esecuzione dello script Python');
      }

      setMessaggio('✅ Formazioni aggiornate con successo tramite scraper.py!');
      
      // Ricarica i dati appena salvati da Supabase
      await caricaFormazioni();
    } catch (err: any) {
      console.error('Errore durante lo scraping:', err);
      setMessaggio(`❌ Errore: ${err.message}`);
    } finally {
      setIsScraping(false);
      setTimeout(() => setMessaggio(''), 5000);
    }
  };

  useEffect(() => {
    caricaFormazioni();
  }, []);

  // Chiusura tendina con click esterno
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMostraDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Gestione input ricerca
  const handleRicercaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQueryRicerca(val);

    if (val.trim().length > 0) {
      const filtrati = tuttiGiocatori.filter((g) =>
        g.nome_completo.toLowerCase().includes(val.toLowerCase()) ||
        g.squadra.toLowerCase().includes(val.toLowerCase())
      );
      setSuggerimenti(filtrati.slice(0, 8));
      setMostraDropdown(true);
    } else {
      setSuggerimenti([]);
      setMostraDropdown(false);
    }
  };

  // Selezione temporanea
  const toggleSelezioneTemp = (giocatore: GiocatoreOption) => {
    if (miaRosa.some((g) => g.id === giocatore.id)) {
      alert(`${giocatore.nome_completo} è già presente nella tua rosa.`);
      return;
    }

    if (selezionatiTemp.some((g) => g.id === giocatore.id)) {
      setSelezionatiTemp(selezionatiTemp.filter((g) => g.id !== giocatore.id));
    } else {
      if (miaRosa.length + selezionatiTemp.length >= 30) {
        alert('Raggiunto il limite massimo di 30 giocatori.');
        return;
      }
      setSelezionatiTemp([...selezionatiTemp, giocatore]);
    }
  };

  // Aggiunta definitiva alla rosa e persistenza locale
  const confermaAggiunta = () => {
    if (selezionatiTemp.length === 0) return;

    const nuovaRosa = [...miaRosa, ...selezionatiTemp];
    aggiornaESalvaRosa(nuovaRosa);

    setSelezionatiTemp([]);
    setQueryRicerca('');
    setSuggerimenti([]);
    setMostraDropdown(false);
    setRisultatoVerifica(null);
  };

  // Rimozione manuale dal salvataggio
  const rimuoviGiocatore = (id: string) => {
    const nuovaRosa = miaRosa.filter((g) => g.id !== id);
    aggiornaESalvaRosa(nuovaRosa);
    setRisultatoVerifica(null);
  };

  // Svuota interamente la rosa salvata
  const svuotaRosa = () => {
    if (confirm('Sei sicuro di voler cancellare tutti i giocatori dalla tua rosa?')) {
      aggiornaESalvaRosa([]);
      setRisultatoVerifica(null);
    }
  };

  const verificaTitolari = () => {
    if (miaRosa.length === 0) return;

    let titolari = 0;
    const dettagli = miaRosa.map((g) => {
      const listaSquadra = squadreMappa[g.squadra] || [];
      const eTitolare = listaSquadra.some(
        (titolare) => titolare.nome.toLowerCase() === g.nome_completo.toLowerCase()
      );
      if (eTitolare) titolari++;
      return {
        nome: g.nome_completo,
        squadra: g.squadra,
        eTitolare,
      };
    });

    setRisultatoVerifica({
      totale: miaRosa.length,
      titolariCount: titolari,
      dettagli,
    });
  };

  const elencoSquadre = Object.keys(squadreMappa);

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <header className="max-w-6xl mx-auto mb-8 border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-amber-400">
            Probabili Formazioni Serie A
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitoraggio in tempo reale sincronizzato con Fantacalcio.it
          </p>
        </div>

        <button
          onClick={avviaScrapingEAggiorna}
          disabled={loading || isScraping}
          className="px-5 py-2.5 rounded-lg font-semibold text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isScraping ? (
            <>
              <span className="animate-spin">🔄</span> Esecuzione scraper.py...
            </>
          ) : (
            <>🚀 Aggiorna Probabili Formazioni</>
          )}
        </button>
      </header>

      {messaggio && (
        <div className="max-w-6xl mx-auto mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm text-center font-medium">
          {messaggio}
        </div>
      )}

      {/* SEZIONE GESTIONE ROSA CON SALVATAGGIO PERMANENTE */}
      <section className="max-w-6xl mx-auto mb-10 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6 border-b border-slate-700 pb-6">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold text-amber-400">La Tua Rosa ({miaRosa.length}/30)</h2>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                💾 Salvata
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Digita un nome per aggiungere giocatori. La lista rimane salvata anche se chiudi il browser.
            </p>
          </div>

          {/* Autocomplete */}
          <div ref={wrapperRef} className="relative w-full md:w-96">
            <div className="relative">
              <input
                type="text"
                value={queryRicerca}
                onChange={handleRicercaChange}
                onFocus={() => queryRicerca.trim() && setMostraDropdown(true)}
                placeholder="Cerca e aggiungi calciatore..."
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-lg pl-4 pr-10 py-2.5 focus:outline-none focus:border-amber-500 transition"
              />
              {queryRicerca && (
                <button
                  onClick={() => {
                    setQueryRicerca('');
                    setSuggerimenti([]);
                    setMostraDropdown(false);
                  }}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Menu Dropdown */}
            {mostraDropdown && suggerimenti.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
                <ul className="max-h-60 overflow-y-auto divide-y divide-slate-800 text-sm">
                  {suggerimenti.map((g) => {
                    const eGiaSelezionato = selezionatiTemp.some((item) => item.id === g.id);
                    const eInRosa = miaRosa.some((item) => item.id === g.id);

                    return (
                      <li
                        key={g.id}
                        onClick={() => !eInRosa && toggleSelezioneTemp(g)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition ${
                          eInRosa
                            ? 'bg-slate-800/50 opacity-50 cursor-not-allowed'
                            : eGiaSelezionato
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <div>
                          <span className="font-semibold">{g.nome_completo}</span>
                          <span className="text-xs text-amber-400/80 ml-2">({g.squadra})</span>
                        </div>
                        {eInRosa ? (
                          <span className="text-xs text-slate-500 font-medium">In rosa</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={eGiaSelezionato}
                            onChange={() => {}}
                            className="rounded border-slate-700 text-amber-500 focus:ring-0"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>

                {selezionatiTemp.length > 0 && (
                  <div className="p-2 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-amber-400 font-medium px-2">
                      {selezionatiTemp.length} selezionati
                    </span>
                    <button
                      onClick={confermaAggiunta}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded text-xs transition"
                    >
                      Aggiungi alla Rosa
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* TABELLA ROSA PERMANENTE */}
        {miaRosa.length > 0 ? (
          <div>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs uppercase bg-slate-900/60 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Giocatore</th>
                    <th className="px-4 py-3">Squadra</th>
                    <th className="px-4 py-3 text-center">Stato Titolarità</th>
                    <th className="px-4 py-3 text-right">Azione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {miaRosa.map((g, idx) => {
                    const infoVerifica = risultatoVerifica?.dettagli.find((d) => d.nome === g.nome_completo);
                    return (
                      <tr key={g.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-100">{g.nome_completo}</td>
                        <td className="px-4 py-2.5 text-amber-300/80">{g.squadra}</td>
                        <td className="px-4 py-2.5 text-center">
                          {infoVerifica ? (
                            infoVerifica.eTitolare ? (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold">
                                TITOLARE
                              </span>
                            ) : (
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full text-xs font-bold">
                                PANCHINA / RISERVA
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500 text-xs">- In attesa di verifica -</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => rimuoviGiocatore(g.id)}
                            className="text-rose-400 hover:text-rose-300 text-xs font-medium"
                          >
                            Elimina
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between pt-2 border-t border-slate-700/60 gap-4">
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  onClick={verificaTitolari}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-lg text-sm transition shadow-lg w-full sm:w-auto"
                >
                  ⚡ Verifica Titolarità Rosa
                </button>
                <button
                  onClick={svuotaRosa}
                  className="bg-slate-700 hover:bg-rose-900/40 text-rose-300 border border-slate-600 hover:border-rose-500/30 px-3 py-2.5 rounded-lg text-xs font-medium transition"
                  title="Svuota l'intera rosa"
                >
                  🗑️ Svuota
                </button>
              </div>

              {risultatoVerifica && (
                <div className="bg-slate-900 border border-amber-500/30 px-5 py-2.5 rounded-lg text-sm font-semibold text-amber-300">
                  Risultato: {risultatoVerifica.titolariCount} su {risultatoVerifica.totale} giocatori sono Titolari!
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm">
            Nessun giocatore salvato nella tua rosa. Cerca e aggiungi calciatori dal campo in alto.
          </div>
        )}
      </section>

      {/* DASHBOARD SQUADRE */}
      <h2 className="max-w-6xl mx-auto text-xl font-bold mb-4 text-slate-300">Tutte le Formazioni</h2>
      <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-slate-500">
            Caricamento dati dal database...
          </div>
        ) : (
          elencoSquadre.map((squadra) => (
            <div key={squadra} className="bg-slate-800 border border-slate-700 rounded-lg p-5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
                <h3 className="text-xl font-bold uppercase text-amber-300 tracking-wider">
                  {squadra}
                </h3>
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium">
                  {squadreMappa[squadra].length} Titolari
                </span>
              </div>

              <ul className="divide-y divide-slate-700/50">
                {squadreMappa[squadra].map((giocatore, idx) => (
                  <li key={idx} className="py-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-200">
                      {idx + 1}. {giocatore.nome}
                    </span>
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono font-semibold">
                      {giocatore.percentuale}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </main>
  );
}