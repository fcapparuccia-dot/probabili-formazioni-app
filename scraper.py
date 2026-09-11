import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURAZIONE SUPABASE ---
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://qozjlebecpjcmbmafnjy.supabase.co")
SUPABASE_KEY = (
    os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
}

MAPPING_SQUADRE = {
    "ATALANTA": "ATALANTA", "BOLOGNA": "BOLOGNA", "CAGLIARI": "CAGLIARI",
    "COMO": "COMO", "FIORENTINA": "FIORENTINA", "FROSINONE": "FROSINONE",
    "GENOA": "GENOA", "INTER": "INTER", "JUVENTUS": "JUVENTUS",
    "LAZIO": "LAZIO", "LECCE": "LECCE", "MILAN": "MILAN",
    "AC MILAN": "MILAN", "MONZA": "MONZA", "NAPOLI": "NAPOLI",
    "PARMA": "PARMA", "ROMA": "ROMA", "SASSUOLO": "SASSUOLO",
    "TORINO": "TORINO", "UDINESE": "UDINESE", "VENEZIA": "VENEZIA",
    "VERONA": "VERONA", "HELLAS VERONA": "VERONA", "EMPOLI": "EMPOLI"
}

def pulisci_nome(nome_grezzo):
    if not nome_grezzo:
        return ""
    nome = re.sub(r'\d{1,3}\s*%', '', nome_grezzo)
    nome = re.sub(r'^[PDCAR]\s+', '', nome, flags=re.IGNORECASE).strip()
    nome = re.sub(r'\s*\(.*?\)', '', nome).strip()
    return nome[:100]

def identifica_squadra(testo_o_nodo):
    testo = str(testo_o_nodo).upper()
    for chiave, valore_ufficiale in MAPPING_SQUADRE.items():
        if re.search(r'\b' + re.escape(chiave) + r'\b', testo):
            return valore_ufficiale
    return None

def scarica_probabili_formazioni():
    print("🚀 Avvio scraping probabili formazioni Serie A...")
    url = "https://www.fantacalcio.it/probabili-formazioni-serie-a"
    
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        res.raise_for_status()
    except Exception as e:
        print(f"❌ Errore HTTP: {e}")
        return [], []

    soup = BeautifulSoup(res.text, "html.parser")
    giocatori_estratti = []
    
    # Selezioniamo tutte le schede squadra
    schedes = soup.find_all(class_=re.compile(r"team-card|team-lineup|card-team|team", re.I))
    if not schedes:
        schedes = [soup]

    squadre_in_ordine = []

    for scheda in schedes:
        squadra_trovata = None
        
        for el in scheda.find_all(["a", "h2", "h3", "h4", "div", "span"]):
            squadra_trovata = identifica_squadra(el.get_text())
            if squadra_trovata:
                break

        if not squadra_trovata:
            for img in scheda.find_all("img"):
                info_img = f"{img.get('alt', '')} {img.get('title', '')} {img.get('src', '')}"
                squadra_trovata = identifica_squadra(info_img)
                if squadra_trovata:
                    break

        if not squadra_trovata:
            continue

        if not squadre_in_ordine or squadre_in_ordine[-1] != squadra_trovata:
            squadre_in_ordine.append(squadra_trovata)

        # Estrazione Giocatori
        player_items = scheda.find_all(["li", "div"], class_=re.compile(r"player|item|row", re.I))
        for item in player_items:
            text_item = item.get_text(" ", strip=True)
            if not text_item or len(text_item) < 3:
                continue

            stato = "titolare"
            parent_text = ""
            p = item.parent
            while p and p != scheda:
                parent_text += " " + p.get_text(" ", strip=True).upper()
                p = p.parent

            if "PANCHINA" in parent_text:
                stato = "panchina"
            elif any(k in parent_text for k in ["INDISPONIBILI", "SQUALIFICATI", "INFORTUNATI"]):
                stato = "indisponibile"

            nome_elem = item.find(class_=re.compile(r"name|player|title", re.I))
            nome_raw = nome_elem.get_text(strip=True) if nome_elem else text_item
            nome_pulito = pulisci_nome(nome_raw)

            if nome_pulito.upper() in MAPPING_SQUADRE or len(nome_pulito) < 2:
                continue

            perc = 0
            match_perc = re.search(r'(\d{1,3})\s*%', text_item)
            if match_perc:
                perc = int(match_perc.group(1))

            giocatori_estratti.append({
                "nome": nome_pulito,
                "squadra": squadra_trovata,
                "stato": stato,
                "percentuale": perc
            })

    # Ricostruzione precisa delle 10 partite accoppiando le squadre in ordine di apparizione
    partite_estratte = []
    squadre_uniche_ordine = []
    for sq in squadre_in_ordine:
        if sq not in squadre_uniche_ordine:
            squadre_uniche_ordine.append(sq)

    for i in range(0, len(squadre_uniche_ordine) - 1, 2):
        partite_estratte.append({
            "casa": squadre_uniche_ordine[i],
            "trasferta": squadre_uniche_ordine[i+1]
        })

    # Deduplicazione giocatori
    visti = set()
    giocatori_finali = []
    for g in giocatori_estratti:
        chiave = f"{g['nome'].lower()}-{g['squadra']}"
        if chiave not in visti:
            visti.add(chiave)
            giocatori_finali.append(g)

    print(f"📊 Estratti {len(giocatori_finali)} giocatori e {len(partite_estratte)} partite.")
    return giocatori_finali, partite_estratte

def salva_su_supabase(giocatori_data, partite_data):
    if not giocatori_data:
        print("⚠️ Nessun dato estratto da salvare.")
        return

    print("🔄 Sincronizzazione dati con Supabase...")

    # 1. Popolamento Squadre
    squadre_uniche = list(set(g["squadra"] for g in giocatori_data))
    for s in squadre_uniche:
        supabase.table("squadre").upsert({"nome": s}, on_conflict="nome").execute()
    
    squadre_db = supabase.table("squadre").select("id, nome").execute().data
    squadra_map = {s["nome"]: s["id"] for s in squadre_db}

    # 2. Popolamento Partite
    if partite_data:
        print(f"🏟️ Inserimento di {len(partite_data)} partite della giornata...")
        
        try:
            existing = supabase.table("partite").select("id").execute().data
            for row in existing:
                supabase.table("partite").delete().eq("id", row["id"]).execute()
        except Exception as e:
            print(f"Errore pulizia partite: {e}")
        
        partite_payload = []
        for idx, p in enumerate(partite_data):
            casa_id = squadra_map.get(p["casa"])
            trasferta_id = squadra_map.get(p["trasferta"])
            if casa_id and trasferta_id:
                partite_payload.append({
                    "squadra_casa_id": casa_id,
                    "squadra_trasferta_id": trasferta_id,
                    "ordine": idx + 1
                })
        
        if partite_payload:
            supabase.table("partite").insert(partite_payload).execute()
            print("✅ Partite salvate con successo!")

    # 3. Popolamento Giocatori
    giocatori_payload = []
    nomi_visti = set()
    for g in giocatori_data:
        nome_c = g["nome"]
        sq_id = squadra_map.get(g["squadra"])
        nome_key = nome_c.lower().strip()
        
        if sq_id and nome_key not in nomi_visti:
            nomi_visti.add(nome_key)
            giocatori_payload.append({
                "nome_completo": nome_c,
                "squadra_id": sq_id
            })

    if giocatori_payload:
        supabase.table("giocatori").upsert(giocatori_payload, on_conflict="nome_completo").execute()

    giocatori_db_aggiornati = supabase.table("giocatori").select("id, nome_completo").execute().data
    giocatore_map = {g["nome_completo"].lower().strip(): g["id"] for g in giocatori_db_aggiornati}

    # 4. Popolamento Formazioni
    formazioni_payload = []
    ids_inseriti = set()
    for g in giocatori_data:
        g_id = giocatore_map.get(g["nome"].lower().strip())
        if g_id and g_id not in ids_inseriti:
            ids_inseriti.add(g_id)
            formazioni_payload.append({
                "giocatore_id": g_id,
                "fonte": "Fantacalcio.it",
                "percentuale_titolarita": g["percentuale"],
                "stato": g["stato"]
            })

    if formazioni_payload:
        supabase.table("probabili_formazioni").upsert(
            formazioni_payload, 
            on_conflict="giocatore_id,fonte"
        ).execute()

    print("🎉 Salvataggio completato con successo su Supabase!")

if __name__ == "__main__":
    giocatori, partite = scarica_probabili_formazioni()
    if giocatori:
        salva_su_supabase(giocatori, partite)