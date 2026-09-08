import os
import re
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# Carica le variabili da .env.local
load_dotenv('.env.local')

# --- CONFIGURAZIONE SUPABASE ---
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://qozjlebecpjcmbmafnjy.supabase.co")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
)

if not SUPABASE_KEY:
    print("⚠️ Attenzione: Nessuna chiave Supabase trovata nelle variabili d'ambiente.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

SQUADRE_SERIE_A = [
    'ATALANTA', 'BOLOGNA', 'CAGLIARI', 'COMO', 'FIORENTINA',
    'FROSINONE', 'GENOA', 'INTER', 'JUVENTUS', 'LAZIO',
    'LECCE', 'MILAN', 'MONZA', 'NAPOLI', 'PARMA',
    'ROMA', 'SASSUOLO', 'TORINO', 'UDINESE', 'VENEZIA'
]

MAPPING_STATO = {
    "titolare": "titolare",
    "panchina": "panchina",
    "indisponibile": "indisponibile"
}

def determina_ruolo(elemento_html, testo_grezzo):
    """
    Individua il ruolo (P, D, C, A) analizzando i tag HTML o il testo grezzo.
    """
    # 1. Cerca attributi o classi CSS tipiche di Fantacalcio (es. role-p, role-d, ecc.)
    html_str = str(elemento_html).lower()
    if 'role-p' in html_str or 'role="p"' in html_str or 'badge-p' in html_str:
        return 'P'
    elif 'role-d' in html_str or 'role="d"' in html_str or 'badge-d' in html_str:
        return 'D'
    elif 'role-c' in html_str or 'role="c"' in html_str or 'badge-c' in html_str:
        return 'C'
    elif 'role-a' in html_str or 'role="a"' in html_str or 'badge-a' in html_str:
        return 'A'

    # 2. Fallback su Regex se presente la lettera singola all'inizio
    match = re.search(r'^\s*([PDCA])\s+', testo_grezzo, flags=re.IGNORECASE)
    if match:
        return match.group(1).upper()

    return "N/D"

def pulisci_nome(nome_grezzo):
    if not nome_grezzo:
        return ""
    nome = re.sub(r'^[PDCAR]\s+', '', nome_grezzo, flags=re.IGNORECASE).strip()
    nome = re.sub(r'\s*\(.*?\)', '', nome).strip()
    return nome[:100]

def scarica_probabili_formazioni():
    print("🚀 Avvio scraping probabili formazioni...")
    url = "https://www.fantacalcio.it/probabili-formazioni-serie-a"
    
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        res.raise_for_status()
    except Exception as e:
        print(f"❌ Errore HTTP: {e}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    dati_estratti = []

    card_partite = soup.find_all('div', class_=re.compile(r'card|match|match-card|match-box', re.I))
    if not card_partite:
        card_partite = soup.find_all('article') or soup.find_all('section')

    for card in card_partite:
        testo_card = card.get_text(" ", strip=True)
        squadre_nel_blocco = [sq for sq in SQUADRE_SERIE_A if sq in testo_card.upper()]
        if not squadre_nel_blocco:
            continue

        righe = card.find_all(['li', 'tr', 'p', 'div', 'span'])
        
        for sq in squadre_nel_blocco:
            stato_attivo = "titolare"
            
            for elem in righe:
                txt = elem.get_text(" ", strip=True)
                txt_upper = txt.upper()

                if "PANCHINA" in txt_upper:
                    stato_attivo = "panchina"
                    continue
                elif "INDISPONIBILI" in txt_upper or "SQUALIFICATI" in txt_upper or "INFORTUNATI" in txt_upper:
                    stato_attivo = "indisponibile"
                    continue
                elif "TITOLARI" in txt_upper:
                    stato_attivo = "titolare"
                    continue

                match = re.search(r'([A-Za-zÀ-Úa-zà-ú\s\.\'\-]+)\s*\(?(\d{1,3})%\)?', txt)
                if match:
                    nome = pulisci_nome(match.group(1))
                    perc = int(match.group(2))
                    ruolo = determina_ruolo(elem, txt)
                    
                    if 2 <= len(nome) <= 30 and nome.upper() not in SQUADRE_SERIE_A:
                        dati_estratti.append({
                            "nome": nome,
                            "ruolo": ruolo,
                            "squadra": sq,
                            "stato": stato_attivo,
                            "percentuale": perc
                        })

    # Backup Parser
    if len(set(g['squadra'] for g in dati_estratti)) < 15:
        squadra_attiva = None
        stato_attivo = "titolare"

        for line in soup.get_text("\n").split("\n"):
            line_str = line.strip()
            if not line_str:
                continue

            line_upper = line_str.upper()

            for sq in SQUADRE_SERIE_A:
                if line_upper == sq or line_upper.startswith(f"{sq} ") or line_upper.endswith(f" {sq}"):
                    squadra_attiva = sq
                    stato_attivo = "titolare"
                    break

            if not squadra_attiva:
                continue

            if "PANCHINA" in line_upper:
                stato_attivo = "panchina"
            elif "INDISPONIBILI" in line_upper or "SQUALIFICATI" in line_upper or "INFORTUNATI" in line_upper:
                stato_attivo = "indisponibile"
            elif "TITOLARI" in line_upper:
                stato_attivo = "titolare"

            match = re.search(r'([A-Za-zÀ-Úa-zà-ú\s\.\'\-]+)\s+(\d{1,3})%', line_str)
            if match:
                nome = pulisci_nome(match.group(1))
                perc = int(match.group(2))
                ruolo = determina_ruolo(line_str, line_str)
                if 2 <= len(nome) <= 30 and nome.upper() not in SQUADRE_SERIE_A:
                    dati_estratti.append({
                        "nome": nome,
                        "ruolo": ruolo,
                        "squadra": squadra_attiva,
                        "stato": stato_attivo,
                        "percentuale": perc
                    })

    # Deduplicazione
    visti = set()
    giocatori_filtrati = []
    for d in dati_estratti:
        key = f"{d['nome'].lower()}-{d['squadra']}"
        if key not in visti:
            visti.add(key)
            giocatori_filtrati.append(d)

    return giocatori_filtrati

def salva_su_supabase(giocatori_data):
    if not giocatori_data:
        print("⚠️ Nessun dato da salvare su Supabase.")
        return

    print("🔄 Sincronizzazione con Supabase in corso...")

    # 1. Squadre
    squadre_uniche = list(set(g["squadra"] for g in giocatori_data))
    squadre_payload = [{"nome": s} for s in squadre_uniche]
    supabase.table("squadre").upsert(squadre_payload, on_conflict="nome").execute()
    
    squadre_db = supabase.table("squadre").select("id, nome").execute().data
    squadra_map = {s["nome"]: s["id"] for s in squadre_db}

    # 2. Giocatori (Aggiornamento esplicito della colonna ruolo)
    for g in giocatori_data:
        nome_comp = g["nome"][:100]
        squadra_id = squadra_map.get(g["squadra"])
        
        if squadra_id:
            payload = {
                "nome_completo": nome_comp,
                "squadra_id": squadra_id
            }
            if g["ruolo"] != "N/D":
                payload["ruolo"] = g["ruolo"]

            supabase.table("giocatori").upsert(
                payload, 
                on_conflict="nome_completo"
            ).execute()

    giocatori_db = supabase.table("giocatori").select("id, nome_completo").execute().data
    giocatore_map = {g["nome_completo"].lower(): g["id"] for g in giocatori_db}

    # 3. Probabili Formazioni
    formazioni_payload = []
    ids_inseriti = set()

    for g in giocatori_data:
        nome_key = g["nome"][:100].lower()
        g_id = giocatore_map.get(nome_key)
        
        if g_id and g_id not in ids_inseriti:
            ids_inseriti.add(g_id)
            stato_db = MAPPING_STATO.get(g["stato"], "panchina")
            
            formazioni_payload.append({
                "giocatore_id": g_id,
                "fonte": "Fantacalcio.it",
                "percentuale_titolarita": g["percentuale"],
                "stato": stato_db
            })

    if formazioni_payload:
        supabase.table("probabili_formazioni").upsert(formazioni_payload, on_conflict="giocatore_id,fonte").execute()

    print("🎉 Sincronizzazione completata!")

if __name__ == "__main__":
    dati = scarica_probabili_formazioni()
    if dati:
        salva_su_supabase(dati)