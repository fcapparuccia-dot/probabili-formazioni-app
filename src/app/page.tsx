"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import CampoFormazione, { GiocatoreRosa } from "@/components/CampoFormazione";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const GUID_MODULO = "00000000-0000-0000-0000-000000000000";

interface GiocatoreProbabile {
  id: string;
  nome_completo: string;
  squadra: string;
  percentuale: number;
  stato: "titolare" | "panchina" | "indisponibile";
}

interface Partita {
  id: string;
  squadraCasa: string;
  squadraOspite: string;
  giocatoriCasa: GiocatoreProbabile[];
  giocatoriOspite: GiocatoreProbabile[];
}

interface GiocatoreDB {
  id: string;
  nome_completo: string;
  squadra: string;
}

export default function ProbabiliFormazioniPage() {
  const [partite, setPartite] = useState<Partita[]>([]);
  const [loading, setLoading] = useState(true);

  const [isGestioneOpen, setIsGestioneOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GiocatoreDB[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [rosaGiocatori, setRosaGiocatori] = useState<GiocatoreRosa[]>([]);
  const [formazioneDB, setFormazioneDB] = useState<{ giocatore_id: string; posizione: string }[]>([]);
  const [moduloDB, setModuloDB] = useState<string>("4-4-2");
  const [tuttiGiocatoriMap, setTuttiGiocatoriMap] = useState<Map<string, GiocatoreProbabile>>(new Map());

  useEffect(() => {
    caricaDati();
  }, []);

  async function caricaDati() {
    setLoading(true);

    // 1. Caricamento Giocatori e Formazioni
    const { data: pfData, error: pfError } = await supabase
      .from("probabili_formazioni")
      .select(`
        percentuale_titolarita,
        stato,
        giocatori (
          id,
          nome_completo,
          squadre ( nome )
        )
      `);

    if (pfError) {
      console.error("Errore caricamento probabili formazioni:", pfError);
      setLoading(false);
      return;
    }

    const map = new Map<string, GiocatoreProbabile>();
    const giocatoriPerSquadra = new Map<string, GiocatoreProbabile[]>();

    pfData?.forEach((item: any) => {
      if (item.giocatori) {
        // Normalizziamo il nome della squadra (maiuscolo e senza spazi) per il matching
        const rawNome = item.giocatori.squadre?.nome || "SCONOSCIUTA";
        const sqNome = rawNome.trim().toUpperCase();

        const gObj: GiocatoreProbabile = {
          id: item.giocatori.id,
          nome_completo: item.giocatori.nome_completo,
          squadra: rawNome,
          percentuale: item.percentuale_titolarita,
          stato: item.stato,
        };
        
        map.set(item.giocatori.id, gObj);

        if (!giocatoriPerSquadra.has(sqNome)) {
          giocatoriPerSquadra.set(sqNome, []);
        }
        giocatoriPerSquadra.get(sqNome)?.push(gObj);
      }
    });

    setTuttiGiocatoriMap(map);

    // 2. Caricamento Partite Reali
    const { data: partiteData, error: partiteError } = await supabase
      .from("partite")
      .select(`
        id,
        ordine,
        squadra_casa:squadre!squadra_casa_id(nome),
        squadra_trasferta:squadre!squadra_trasferta_id(nome)
      `)
      .order("ordine", { ascending: true });

    if (partiteError) {
      console.error("Errore caricamento partite:", JSON.stringify(partiteError, null, 2));
    } else if (partiteData) {
      const listaPartiteFormattate: Partita[] = partiteData.map((p: any) => {
        const casaNomeOriginale = p.squadra_casa?.nome || "CASA";
        const ospiteNomeOriginale = p.squadra_trasferta?.nome || "TRASFERTA";

        const casaKey = casaNomeOriginale.trim().toUpperCase();
        const ospiteKey = ospiteNomeOriginale.trim().toUpperCase();

        return {
          id: p.id,
          squadraCasa: casaNomeOriginale,
          squadraOspite: ospiteNomeOriginale,
          giocatoriCasa: giocatoriPerSquadra.get(casaKey) || [],
          giocatoriOspite: giocatoriPerSquadra.get(ospiteKey) || [],
        };
      });

      setPartite(listaPartiteFormattate);
    }

    await ricaricaMiaFormazione(map);
    setLoading(false);
  }

  async function ricaricaMiaFormazione(mapGiocatori = tuttiGiocatoriMap) {
    const { data: miaFormData, error: errRosa } = await supabase
      .from("mia_formazione")
      .select("id, giocatore_id, posizione, ordine")
      .order("ordine", { ascending: true });

    if (errRosa || !miaFormData) {
      console.error("Errore lettura mia_formazione:", errRosa);
      return;
    }

    const rigaModulo = miaFormData.find((r: any) => r.giocatore_id === GUID_MODULO);
    if (rigaModulo && rigaModulo.posizione.startsWith("SCHEMA_")) {
      setModuloDB(rigaModulo.posizione.replace("SCHEMA_", ""));
    }

    const righeGiocatori = miaFormData.filter((r: any) => r.giocatore_id !== GUID_MODULO);
    setFormazioneDB(righeGiocatori);

    const idsGiocatori = righeGiocatori.map((row: any) => row.giocatore_id).filter(Boolean);
    if (idsGiocatori.length === 0) {
      setRosaGiocatori([]);
      return;
    }

    const { data: infoGiocatori, error: errGioc } = await supabase
      .from("giocatori")
      .select(`
        id,
        nome_completo,
        squadre ( nome )
      `)
      .in("id", idsGiocatori);

    if (errGioc) {
      console.error("Errore lettura giocatori:", errGioc);
      return;
    }

    const mappaAnagrafica = new Map<string, any>();
    infoGiocatori?.forEach((g: any) => mappaAnagrafica.set(g.id, g));

    const listaRosa: GiocatoreRosa[] = [];

    righeGiocatori.forEach((row: any) => {
      const gId = row.giocatore_id;
      const anag = mappaAnagrafica.get(gId);
      const infoScraper = mapGiocatori.get(gId);

      if (anag) {
        listaRosa.push({
          id: gId,
          nome: anag.nome_completo || "Sconosciuto",
          squadra: anag.squadre?.nome || "",
          percentuale: infoScraper ? infoScraper.percentuale : 0,
          stato: infoScraper ? infoScraper.stato : "panchina",
        });
      }
    });

    setRosaGiocatori(listaRosa);
  }

  async function salvaModulo(modulo: string) {
    setModuloDB(modulo);
    await supabase.from("mia_formazione").upsert(
      {
        giocatore_id: GUID_MODULO,
        posizione: `SCHEMA_${modulo}`,
        ordine: -1,
      },
      { onConflict: "giocatore_id" }
    );
  }

  async function salvaPosizioneGiocatore(giocatoreId: string, posizione: string) {
    const { error } = await supabase.from("mia_formazione").upsert(
      {
        giocatore_id: giocatoreId,
        posizione: posizione,
      },
      { onConflict: "giocatore_id" }
    );

    if (error) {
      console.error("Errore salvataggio posizione:", error);
    } else {
      setFormazioneDB((prev) =>
        prev.map((item) =>
          item.giocatore_id === giocatoreId ? { ...item, posizione } : item
        )
      );
    }
  }

  async function cercaGiocatori(query: string) {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const { data, error } = await supabase
      .from("giocatori")
      .select(`
        id,
        nome_completo,
        squadre ( nome )
      `)
      .ilike("nome_completo", `%${query}%`)
      .limit(10);

    if (!error && data) {
      setSearchResults(
        data.map((item: any) => ({
          id: item.id,
          nome_completo: item.nome_completo,
          squadra: item.squadre?.nome || "",
        }))
      );
    }
    setIsSearching(false);
  }

  async function aggiungiGiocatore(giocatoreId: string) {
    const prossimoOrdine = rosaGiocatori.length + 1;

    const { error } = await supabase.from("mia_formazione").upsert(
      {
        giocatore_id: giocatoreId,
        posizione: "PANCHINA",
        ordine: prossimoOrdine,
      },
      { onConflict: "giocatore_id" }
    );

    if (error) {
      alert("Errore nell'inserimento: " + error.message);
      return;
    }

    setSearchQuery("");
    setSearchResults([]);
    await ricaricaMiaFormazione();
  }

  async function rimuoviGiocatore(giocatoreId: string) {
    const { error } = await supabase
      .from("mia_formazione")
      .delete()
      .eq("giocatore_id", giocatoreId);

    if (error) return;
    await ricaricaMiaFormazione();
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-950 text-white">
        <p className="text-xl animate-pulse">Caricamento probabili formazioni in corso...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="max-w-6xl mx-auto mb-8 text-center border-b border-slate-800 pb-4">
        <h1 className="text-3xl md:text-5xl font-extrabold text-blue-500 uppercase tracking-wide">
          Probabili Formazioni Serie A
        </h1>
        <p className="text-slate-400 mt-2 text-sm md:text-base">
          Percentuali e ultime notizie dai campi aggiornate in tempo reale.
        </p>
      </header>

      <div className="max-w-6xl mx-auto space-y-10">
        {isGestioneOpen && (
          <div className="p-4 bg-slate-900 border border-amber-500/50 rounded-xl space-y-4">
            <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">
              Aggiungi Giocatore alla tua Rosa
            </h3>
            
            <div className="relative">
              <input
                type="text"
                placeholder="Cerca un giocatore per nome (es: Lautaro, Barella)..."
                value={searchQuery}
                onChange={(e) => cercaGiocatori(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />

              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                  {searchResults.map((g) => (
                    <div
                      key={g.id}
                      className="flex justify-between items-center px-4 py-2.5 border-b border-slate-800/80 hover:bg-slate-800/50"
                    >
                      <div>
                        <span className="font-semibold text-white">{g.nome_completo}</span>
                        <span className="text-xs text-slate-400 ml-2">({g.squadra})</span>
                      </div>
                      <button
                        onClick={() => aggiungiGiocatore(g.id)}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-2.5 py-1 rounded font-bold"
                      >
                        + Aggiungi alla Rosa
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {isSearching && <p className="text-xs text-slate-400 mt-1">Ricerca in corso...</p>}
            </div>

            {rosaGiocatori.length > 0 && (
              <div className="mt-4 border-t border-slate-800 pt-3">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">Giocatori in rosa ({rosaGiocatori.length}):</h4>
                <div className="flex flex-wrap gap-2">
                  {rosaGiocatori.map((g) => (
                    <span key={g.id} className="inline-flex items-center gap-1.5 text-xs bg-slate-800 text-slate-200 px-2.5 py-1 rounded border border-slate-700">
                      {g.nome} ({g.percentuale}%)
                      <button onClick={() => rimuoviGiocatore(g.id)} className="text-red-400 hover:text-red-300 font-bold ml-1">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <CampoFormazione
          rosa={rosaGiocatori}
          formazioneDB={formazioneDB}
          moduloDB={moduloDB}
          onApriGestioneRosa={() => setIsGestioneOpen(!isGestioneOpen)}
          onSalvaPosizione={salvaPosizioneGiocatore}
          onSalvaModulo={salvaModulo}
        />

        <div className="grid grid-cols-1 gap-8">
          {partite.map((partita) => (
            <div
              key={partita.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg"
            >
              <div className="bg-slate-800/80 px-6 py-3 border-b border-slate-700 flex justify-between items-center">
                <span className="font-black text-lg md:text-xl text-white tracking-wider">
                  {partita.squadraCasa}
                </span>
                <span className="text-xs text-slate-400 font-semibold px-3 py-1 bg-slate-900 rounded-full border border-slate-700">
                  VS
                </span>
                <span className="font-black text-lg md:text-xl text-white tracking-wider">
                  {partita.squadraOspite}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                <ColonnaSquadra squadraNome={partita.squadraCasa} giocatori={partita.giocatoriCasa} />
                <ColonnaSquadra squadraNome={partita.squadraOspite} giocatori={partita.giocatoriOspite} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function ColonnaSquadra({ giocatori }: { squadraNome: string; giocatori: GiocatoreProbabile[] }) {
  const titolari = giocatori.filter((g) => g.stato === "titolare");
  const panchina = giocatori.filter((g) => g.stato === "panchina");
  const indisponibili = giocatori.filter((g) => g.stato === "indisponibile");

  return (
    <div className="p-4 md:p-5 space-y-4">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2 border-b border-slate-800 pb-1">
          TITOLARI ({titolari.length})
        </h4>
        <div className="space-y-1.5">
          {titolari.map((g) => (
            <div key={g.id} className="flex justify-between items-center text-sm py-1 border-b border-slate-800/50">
              <span className="font-medium text-slate-200">{g.nome_completo}</span>
              <BadgePercentuale perc={g.percentuale} />
            </div>
          ))}
        </div>
      </div>

      {panchina.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-800 pb-1">
            PANCHINA
          </h4>
          <div className="space-y-1.5">
            {panchina.map((g) => (
              <div key={g.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/30 text-slate-400">
                <span>{g.nome_completo}</span>
                <BadgePercentuale perc={g.percentuale} />
              </div>
            ))}
          </div>
        </div>
      )}

      {indisponibili.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-2 border-b border-slate-800 pb-1">
            INDISPONIBILI / SQUALIFICATI
          </h4>
          <div className="space-y-1 text-xs text-rose-400/80">
            {indisponibili.map((g) => (
              <div key={g.id}>{g.nome_completo}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BadgePercentuale({ perc }: { perc: number }) {
  let colore = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (perc < 40) {
    colore = "bg-rose-500/20 text-rose-400 border-rose-500/30";
  } else if (perc < 70) {
    colore = "bg-amber-500/20 text-amber-400 border-amber-500/30";
  }

  return <span className={`text-xs font-bold px-2 py-0.5 rounded border ${colore}`}>{perc}%</span>;
}