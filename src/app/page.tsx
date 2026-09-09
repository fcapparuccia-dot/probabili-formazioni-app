"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import CampoFormazione from "@/components/CampoFormazione";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const [miaFormazione, setMiaFormazione] = useState<{
    titolari: GiocatoreProbabile[];
    panchina: GiocatoreProbabile[];
  }>({ titolari: [], panchina: [] });
  const [loading, setLoading] = useState(true);

  // Gestione Modale e Ricerca Giocatori
  const [isGestioneOpen, setIsGestioneOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GiocatoreDB[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [tuttiGiocatoriMap, setTuttiGiocatoriMap] = useState<Map<string, GiocatoreProbabile>>(new Map());

  useEffect(() => {
    caricaDati();
  }, []);

  async function caricaDati() {
    setLoading(true);

    const { data: pfData, error } = await supabase
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

    if (error) {
      console.error("Errore caricamento probabili formazioni:", error);
      setLoading(false);
      return;
    }

    const tuttiGiocatori: GiocatoreProbabile[] = [];
    const map = new Map<string, GiocatoreProbabile>();

    pfData?.forEach((item: any) => {
      if (item.giocatori) {
        const gObj: GiocatoreProbabile = {
          id: item.giocatori.id,
          nome_completo: item.giocatori.nome_completo,
          squadra: item.giocatori.squadre?.nome || "SCONOSCIUTA",
          percentuale: item.percentuale_titolarita,
          stato: item.stato,
        };
        tuttiGiocatori.push(gObj);
        map.set(item.giocatori.id, gObj);
      }
    });

    setTuttiGiocatoriMap(map);

    const partiteRaggruppate = creaStrutturaPartite(tuttiGiocatori);
    setPartite(partiteRaggruppate);

    await ricaricaMiaFormazione(map);
    setLoading(false);
  }

  async function ricaricaMiaFormazione(mapGiocatori = tuttiGiocatoriMap) {
    const { data: miaFormData } = await supabase
      .from("mia_formazione")
      .select(`
        id,
        posizione,
        ordine,
        giocatori (
          id,
          nome_completo,
          squadre ( nome )
        )
      `)
      .order("ordine", { ascending: true });

    if (miaFormData) {
      const titolari: GiocatoreProbabile[] = [];
      const panchina: GiocatoreProbabile[] = [];

      miaFormData.forEach((row: any) => {
        const gId = row.giocatori?.id;
        const infoScraper = mapGiocatori.get(gId);

        const gObj: GiocatoreProbabile = {
          id: gId,
          nome_completo: row.giocatori?.nome_completo || "Sconosciuto",
          squadra: row.giocatori?.squadre?.nome || "",
          percentuale: infoScraper ? infoScraper.percentuale : 0,
          stato: infoScraper ? infoScraper.stato : "panchina",
        };

        if (row.posizione === "TITOLARE") {
          titolari.push(gObj);
        } else {
          panchina.push(gObj);
        }
      });

      setMiaFormazione({ titolari, panchina });
    }
  }

  function creaStrutturaPartite(giocatori: GiocatoreProbabile[]): Partita[] {
    const squadrePresenti = Array.from(new Set(giocatori.map((g) => g.squadra)));
    const listaPartite: Partita[] = [];

    for (let i = 0; i < squadrePresenti.length; i += 2) {
      const sqCasa = squadrePresenti[i];
      const sqOspite = squadrePresenti[i + 1] || "RIPOSO";

      listaPartite.push({
        id: `${sqCasa}-${sqOspite}`,
        squadraCasa: sqCasa,
        squadraOspite: sqOspite,
        giocatoriCasa: giocatori.filter((g) => g.squadra === sqCasa),
        giocatoriOspite: giocatori.filter((g) => g.squadra === sqOspite),
      });
    }

    return listaPartite;
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

  async function aggiungiGiocatore(giocatoreId: string, posizione: "TITOLARE" | "PANCHINA") {
    const ordine = posizione === "PANCHINA" ? miaFormazione.panchina.length + 1 : 0;

    await supabase.from("mia_formazione").upsert(
      {
        giocatore_id: giocatoreId,
        posizione: posizione,
        ordine: ordine,
      },
      { onConflict: "giocatore_id" }
    );

    setSearchQuery("");
    setSearchResults([]);
    await ricaricaMiaFormazione();
  }

  async function rimuoviGiocatore(giocatoreId: string) {
    await supabase.from("mia_formazione").delete().eq("giocatore_id", giocatoreId);
    await ricaricaMiaFormazione();
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-950 text-white">
        <p className="text-xl animate-pulse">Caricamento probabili formazioni in corso...</p>
      </div>
    );
  }

  // Prepariamo la rosa totale per il Drag & Drop sul Campo
  const rosaCompleta = [...miaFormazione.titolari, ...miaFormazione.panchina];

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
        
        {/* ================= SEZIONE LA MIA FORMAZIONE ================= */}
        <section className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between mb-4 border-b border-slate-800 pb-3 gap-2">
            <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
              ⭐ La Mia Formazione
            </h2>
            <button
              onClick={() => setIsGestioneOpen(!isGestioneOpen)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm px-4 py-2 rounded-lg transition-all shadow-md"
            >
              {isGestioneOpen ? "✖ Chiudi Gestione" : "✏️ Gestisci Rosa"}
            </button>
          </div>

          {/* PANNELLO DI INSERIMENTO / RICERCA */}
          {isGestioneOpen && (
            <div className="mb-6 p-4 bg-slate-950 rounded-xl border border-amber-500/30 space-y-4">
              <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">
                Aggiungi Giocatore alla tua Rosa
              </h3>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cerca un giocatore per nome (es: Lautaro, Barella)..."
                  value={searchQuery}
                  onChange={(e) => cercaGiocatori(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => aggiungiGiocatore(g.id, "PANCHINA")}
                            className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-2.5 py-1 rounded font-bold"
                          >
                            + Aggiungi alla Rosa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isSearching && (
                  <p className="text-xs text-slate-400 mt-1">Ricerca in corso...</p>
                )}
              </div>
            </div>
          )}

          {/* VISTA CAMPO DI CALCIO CON DRAG & DROP */}
          {rosaCompleta.length === 0 ? (
            <p className="text-slate-500 text-sm italic text-center py-6">
              Nessun giocatore in rosa. Clicca su <strong>"Gestisci Rosa"</strong> in alto per inserire i tuoi calciatori!
            </p>
          ) : (
            <CampoFormazione rosa={rosaCompleta} />
          )}
        </section>

        {/* ================= SCHEDE PARTITE ================= */}
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
                <ColonnaSquadra
                  squadraNome={partita.squadraCasa}
                  giocatori={partita.giocatoriCasa}
                />
                <ColonnaSquadra
                  squadraNome={partita.squadraOspite}
                  giocatori={partita.giocatoriOspite}
                />
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}

function ColonnaSquadra({
  squadraNome,
  giocatori,
}: {
  squadraNome: string;
  giocatori: GiocatoreProbabile[];
}) {
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
            <div
              key={g.id}
              className="flex justify-between items-center text-sm py-1 border-b border-slate-800/50"
            >
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
              <div
                key={g.id}
                className="flex justify-between items-center text-xs py-1 border-b border-slate-800/30 text-slate-400"
              >
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

  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${colore}`}>
      {perc}%
    </span>
  );
}