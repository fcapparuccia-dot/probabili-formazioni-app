import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

print("🔍 --- AVVIO DIAGNOSTICA COMPLETA --- 🔍\n")

# 1. TEST CONNESSIONE A FANTACALCIO.IT
url = "https://www.fantacalcio.it/probabili-formazioni-serie-a"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
}

try:
    res = requests.get(url, headers=headers, timeout=15)
    print(f"1. Status Code HTTP: {res.status_code}")
    print(f"   Lunghezza risposta HTML: {len(res.text)} caratteri")
    
    if res.status_code == 200:
        soup = BeautifulSoup(res.text, "html.parser")
        titolo = soup.title.string if soup.title else "Nessun titolo"
        print(f"   Titolo Pagina: '{titolo.strip()}'")
        
        # Cerca parole chiave nel testo grezzo per capire se ci sono giocatori/percentuali
        percentuali = soup.text.count("%")
        print(f"   Occorrenze del simbolo '%': {percentuali}")
        
        if "Attention Required" in titolo or "Cloudflare" in titolo or percentuali == 0:
            print("   ❌ ESITO PARSING: Il sito sta bloccando la richiesta o restituisce una pagina vuota/anti-bot.")
        else:
            print("   ✅ ESITO PARSING: L'HTML è stato scaricato correttamente.")
    else:
        print("   ❌ ESITO HTTP: Il sito ha rifiutato la connessione.")

except Exception as e:
    print(f"   ❌ ERRORE RICHIESTA HTTP: {e}")

print("\n" + "="*40 + "\n")

# 2. TEST CONNESSIONE SUPABASE
url_sp = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key_sp = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

print(f"2. Credenziali Supabase:")
print(f"   URL: {url_sp}")
print(f"   KEY: {'Presente (' + key_sp[:10] + '...)' if key_sp else '❌ MANCANTE'}")

if url_sp and key_sp:
    try:
        supabase = create_client(url_sp, key_sp)
        # Prova una semplice lettura
        res_sq = supabase.table("squadre").select("count", count="exact").execute()
        res_gio = supabase.table("giocatori").select("count", count="exact").execute()
        print("   ✅ Connessione Supabase riuscita!")
        print(f"   Righe attuali in 'squadre': {res_sq.count}")
        print(f"   Righe attuali in 'giocatori': {res_gio.count}")
    except Exception as e:
        print(f"   ❌ ERRORE CONNESSIONE SUPABASE: {e}")
else:
    print("   ❌ Impossibile testare Supabase: Manca URL o KEY nel file .env")

print("\n🔍 --- FINE DIAGNOSTICA --- 🔍")