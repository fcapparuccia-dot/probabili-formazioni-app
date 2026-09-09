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

# Mapping ufficiale delle 20 squadre di Serie A
MAPPING_SQUADRE = {
    "ATALANTA": "ATALANTA",
    "BOLOGNA": "BOLOGNA",
    "CAGLIARI": "CAGLIARI",
    "COMO": "COMO",
    "FIORENTINA": "FIORENTINA",
    "FROSINONE": "FROSINONE",
    "GENOA": "GENOA",
    "INTER": "INTER",
    "JUVENTUS": "JUVENTUS",
    "LAZIO": "LAZIO",
    "LECCE": "LECCE",
    "MILAN": "MILAN",
    "AC MILAN": "MILAN",
    "MONZA": "MONZA",
    "NAPOLI": "NAPOLI",
    "PARMA": "PARMA",
    "ROMA": "ROMA",
    "SASSUOLO": "SASSUOLO",
    "TORINO": "TORINO",
    "UDINESE": "UDINESE",
    "VENEZIA": "VENEZIA"
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
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    giocatori_estratti = []

    # Cerchiamo specificamente le schede singole delle squadre evitando contenitori generici
    schede_squadra = soup.find_all("div", class_=re.compile(r"team-card|team-lineup", re.I))

    # Fallback se non trova team-card
    if not schede_squadra:
        schede_squadra = soup.find_all("div", class_=re.compile(r"\bteam\b", re.I))

    for scheda in schede_squadra:
        player_items = scheda.find_all("li", class_=re.compile(r"player-item|player", re.I))
        if not player_items:
            continue

        squadra_trovata = None

        # Identificazione squadra solo nell'intestazione della scheda
        header = scheda.find(class_=re.compile(r"team-name|team-link|header|title|name", re.I))
        if header:
            squadra_trovata = identifica_squadra(header.get_text())

        if not squadra_trovata:
            # Controllo immagini stemmi
            imgs = scheda.find_all("img")
            for img in imgs:
                info_img = f"{img.get('alt', '')} {img.get('title', '')} {img.get('src', '')}"
                squadra_trovata = identifica_squadra(info_img)
                if squadra_trovata:
                    break

        if not squadra_trovata:
            continue

        for item in player_items:
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

            nome_elem = item.find(class_=re.compile(r"player-name|player-link|name", re.I))
            nome_raw = nome_elem.get_text(strip=True) if nome_elem else item.get_text(" ", strip=True)
            nome_pulito = pulisci_nome(nome_raw)

            if nome_pulito.upper() in MAPPING_SQUADRE:
                continue

            perc_elem = item.find(class_=re.compile(r"progress-value|percentage", re.I))
            perc = 0
            if perc_elem:
                match_perc = re.search(r'(\d{1,3})', perc_elem.get_text(strip=True))
                if match_perc:
                    perc = int(match_perc.group(1))
            else:
                match_perc = re.search(r'(\d{1,3})\s*%', item.get_text(strip=True))
                if match_perc:
                    perc = int(match_perc.group(1))

            if nome_pulito and len(nome_pulito) >= 2:
                giocatori_estratti.append({
                    "nome": nome_pulito,
                    "squadra": squadra_trovata,
                    "stato": stato,
                    "percentuale": perc
                })

    # Deduplicazione locale
    visti = set()
    risultato_finale = []
    for g in giocatori_estratti:
        chiave = f"{g['nome'].lower()}-{g['squadra']}"
        if chiave not in visti:
            visti.add(chiave)
            risultato_finale.append(g)

    squadre_trovate = sorted(list(set(g['squadra'] for g in risultato_finale)))
    print(f"✅ Estratti {len(risultato_finale)} giocatori per {len(squadre_trovate)} squadre.")
    if squadre_trovate:
        print(f"📋 Squadre identificate ({len(squadre_trovate)}/20): {', '.join(squadre_trovate)}")
    
    return risultato_finale

def salva_su_supabase(giocatori_data):
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

    # 2. Popolamento Giocatori (Deduplicazione rigida del payload)
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
        print(f"➕ Inserimento/Aggiornamento di {len(giocatori_payload)} giocatori...")
        supabase.table("giocatori").upsert(
            giocatori_payload, 
            on_conflict="nome_completo"
        ).execute()

    # Mappa aggiornata dei giocatori dal DB
    giocatori_db_aggiornati = supabase.table("giocatori").select("id, nome_completo").execute().data
    giocatore_map = {g["nome_completo"].lower().strip(): g["id"] for g in giocatori_db_aggiornati}

    # 3. Popolamento Formazioni
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
    dati = scarica_probabili_formazioni()
    if dati:
        salva_su_supabase(dati)