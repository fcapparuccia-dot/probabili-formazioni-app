"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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

export default function ProbabiliFormazioniPage() {
  const [partite, setPartite] = useState<Partita[]>([]);
  const [miaFormazione, setMiaFormazione] = useState<{
    titolari: GiocatoreProbabile[];
    panchina: GiocatoreProbabile[];
  }>({ titolari: [], panchina: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    caricaDati();
  }, []);

  async function caricaDati() {
    setLoading(true);

    // 1. Recupera probabili formazioni da Supabase
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

    // Mappatura dati giocatori
    const tuttiGiocatori: (GiocatoreProbabile & { squadra_id?: string })[] = [];
    
    pfData?.forEach((item: any) => {
      if (item.giocatori) {
        tuttiGiocatori.push({
          id: item.giocatori.id,
          nome_completo: item.giocatori.nome_completo,
          squadra: item.giocatori.squadre?.nome || "SCONOSCIUTA",
          percentuale: item.percentuale_titolarita,
          stato: item.stato,
        });
      }
    });

    // Raggruppa i giocatori per partite (a coppie di squadre)
    const partiteRaggruppate = creaStrutturaPartite(tuttiGiocatori);
    setPartite(partiteRaggruppate);

    // 2. Recupera "La Mia Formazione" dal database
    const { data: miaFormData } = await supabase
      .from("mia_formazione")
      .select(`
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
        const infoScraper = tuttiGiocatori.find(
          (g) => g.id === row.giocatori?.id
        );

        const gObj: GiocatoreProbabile = {
          id: row.giocatori?.id,
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

    setLoading(false);
  }

  // Funzione di supporto per raggruppare i giocatori nelle partite
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-900 text-white">
        <p className="text-xl animate-pulse">Caricamento probabili formazioni in corso...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* HEADER STILE FANTACALCIO */}
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
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
              ⭐ La Mia Formazione
            </h2>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
              Personalizzata
            </span>
          </div>

          {miaFormazione.titolari.length === 0 && miaFormazione.panchina.length === 0 ? (
            <p className="text-slate-500 text-sm italic text-center py-4">
              Nessun giocatore inserito in "mia_formazione" nel database.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TITOLARI MII */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h3 className="text-emerald-400 font-bold uppercase text-sm mb-3 border-b border-slate-800 pb-1">
                  Titolari ({miaFormazione.titolari.length})
                </h3>
                <ul className="space-y-2">
                  {miaFormazione.titolari.map((g) => (
                    <li
                      key={g.id}
                      className="flex justify-between items-center text-sm p-2 rounded bg-slate-900/80 border border-slate-800"
                    >
                      <div>
                        <span className="font-semibold text-white">{g.nome_completo}</span>
                        <span className="text-xs text-slate-500 ml-2">({g.squadra})</span>
                      </div>
                      <BadgePercentuale perc={g.percentuale} />
                    </li>
                  ))}
                </ul>
              </div>

              {/* PANCHINA MIA */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h3 className="text-amber-400 font-bold uppercase text-sm mb-3 border-b border-slate-800 pb-1">
                  Panchina ({miaFormazione.panchina.length})
                </h3>
                <ul className="space-y-2">
                  {miaFormazione.panchina.map((g, idx) => (
                    <li
                      key={g.id}
                      className="flex justify-between items-center text-sm p-2 rounded bg-slate-900/80 border border-slate-800"
                    >
                      <div>
                        <span className="text-xs text-slate-500 mr-2">{idx + 1}.</span>
                        <span className="font-semibold text-slate-200">{g.nome_completo}</span>
                        <span className="text-xs text-slate-500 ml-2">({g.squadra})</span>
                      </div>
                      <BadgePercentuale perc={g.percentuale} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* ================= SCHEDE PARTITE (CLONE FANTACALCIO) ================= */}
        <div className="grid grid-cols-1 gap-8">
          {partite.map((partita) => (
            <div
              key={partita.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg"
            >
              {/* INTESTAZIONE PARTITA */}
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

              {/* CONTENUTO SCHEDA - DUE COLONNE */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                
                {/* SQUADRA CASA */}
                <ColonnaSquadra
                  squadraNome={partita.squadraCasa}
                  giocatori={partita.giocatoriCasa}
                />

                {/* SQUADRA OSPITE */}
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

{/* COMPONENTE COLONNA SQUADRA */}
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
      {/* TITOLARI */}
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

      {/* PANCHINA */}
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

      {/* INDISPONIBILI */}
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

{/* BADGE PERCENTUALE COLORTATO */}
function BadgePercentuale({ perc }: { perc: number }) {
  let colore = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (perc < 40) {
    colore = "bg-rose-500/20 text-rose-400 border-rose-500/30";
  } else if (perc < 70) {
    colore = "bg-amber-500/20 text-amber-400 border-amber-500/30";
  }

  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded border ${colore}`}
    >
      {perc}%
    </span>
  );
}