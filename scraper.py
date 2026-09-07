import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

# --- CONFIGURAZIONE SUPABASE ---
SUPABASE_URL = "https://qozjlebecpjcmbmafnjy.supabase.co"
SUPABASE_KEY = "sb_secret_LRYw7lqly8f4V1t1sUALhQ_exO8bV3t"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

# Lista ufficiale Serie A 2026/27
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

    # Cerchiamo le schede delle partite/squadre
    card_partite = soup.find_all('div', class_=re.compile(r'card|match|match-card|match-box', re.I))
    
    if not card_partite:
        # Fallback se le classi cambiano
        card_partite = soup.find_all('article') or soup.find_all('section')

    for card in card_partite:
        testo_card = card.get_text(" ", strip=True)
        
        # Identifica le squadre presenti nel blocco
        squadre_nel_blocco = [sq for sq in SQUADRE_SERIE_A if sq in testo_card.upper()]
        if not squadre_nel_blocco:
            continue

        # Cerca righe o blocchi contenenti giocatori e percentuali
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

                # Pattern per estrarre giocatore e percentuale (es. "Lautaro 80%" o "Lautaro (80%)")
                match = re.search(r'([A-Za-zÀ-Úa-zà-ú\s\.\'\-]+)\s*\(?(\d{1,3})%\)?', txt)
                if match:
                    nome = pulisci_nome(match.group(1))
                    perc = int(match.group(2))
                    
                    if 2 <= len(nome) <= 30 and nome.upper() not in SQUADRE_SERIE_A:
                        dati_estratti.append({
                            "nome": nome,
                            "squadra": sq,
                            "stato": stato_attivo,
                            "percentuale": perc
                        })

    # Backup Parser Globale se il parser per card restituisce poche squadre
    if len(set(g['squadra'] for g in dati_estratti)) < 15:
        squadra_attiva = None
        stato_attivo = "titolare"

        for line in soup.get_text("\n").split("\n"):
            line_str = line.strip()
            if not line_str:
                continue

            line_upper = line_str.upper()

            # Cambio squadra attiva
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
                if 2 <= len(nome) <= 30 and nome.upper() not in SQUADRE_SERIE_A:
                    dati_estratti.append({
                        "nome": nome,
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

    squadre_trovate = sorted(list(set(g['squadra'] for g in giocatori_filtrati)))
    print(f"✅ Estratti {len(giocatori_filtrati)} giocatori per {len(squadre_trovate)} squadre.")
    print(f"📋 Squadre identificate ({len(squadre_trovate)}): {', '.join(squadre_trovate)}")

    return giocatori_filtrati

def salva_su_supabase(giocatori_data):
    if not giocatori_data:
        print("⚠️ Nessun dato da salvare su Supabase.")
        return

    print("🔄 Sincronizzazione con Supabase in corso...")

    # 1. Upsert Squadre
    squadre_uniche = list(set(g["squadra"] for g in giocatori_data))
    squadre_payload = [{"nome": s} for s in squadre_uniche]
    supabase.table("squadre").upsert(squadre_payload, on_conflict="nome").execute()
    
    squadre_db = supabase.table("squadre").select("id, nome").execute().data
    squadra_map = {s["nome"]: s["id"] for s in squadre_db}

    # 2. Upsert Giocatori
    giocatori_payload = []
    nomi_inseriti = set()
    
    for g in giocatori_data:
        nome_comp = g["nome"][:100]
        squadra_id = squadra_map.get(g["squadra"])
        
        if squadra_id and nome_comp.lower() not in nomi_inseriti:
            nomi_inseriti.add(nome_comp.lower())
            giocatori_payload.append({
                "nome_completo": nome_comp,
                "squadra_id": squadra_id
            })

    if giocatori_payload:
        supabase.table("giocatori").upsert(giocatori_payload, on_conflict="nome_completo").execute()

    giocatori_db = supabase.table("giocatori").select("id, nome_completo").execute().data
    giocatore_map = {g["nome_completo"].lower(): g["id"] for g in giocatori_db}

    # 3. Upsert Probabili Formazioni
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

    print("🎉 Sincronizzazione completata con successo!")

if __name__ == "__main__":
    dati = scarica_probabili_formazioni()
    if dati:
        salva_su_supabase(dati)