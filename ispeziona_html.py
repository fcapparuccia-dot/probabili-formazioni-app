import requests
from bs4 import BeautifulSoup
import re
import json

url = "https://www.fantacalcio.it/probabili-formazioni-serie-a"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

print("📥 Scaricamento HTML per ispezione...")
res = requests.get(url, headers=headers, timeout=15)
soup = BeautifulSoup(res.text, "html.parser")

# 1. Verifichiamo se ci sono dati JSON embedded (__NEXT_DATA__)
next_data = soup.find("script", id="__NEXT_DATA__")
if next_data:
    print("✅ Trovato blocco __NEXT_DATA__ (Next.js Data)!")
    try:
        data = json.loads(next_data.string)
        print("   Anteprima chiavi JSON principali:", list(data.get("props", {}).get("pageProps", {}).keys()))
    except Exception as e:
        print("   Errore nel parsing JSON:", e)
else:
    print("❌ Nessun blocco __NEXT_DATA__ trovato.")

# 2. Cerchiamo le classi CSS relative a giocatori o percentuali
print("\n🔍 Ricerca selettori e classi rilevanti nell'HTML:")
classi_giocatori = set()
for tag in soup.find_all(True, class_=True):
    for cls in tag["class"]:
        if any(k in cls.lower() for k in ["player", "giocatore", "titolar", "formazion", "team", "squadra", "percent"]):
            classi_giocatori.add(cls)

print(f"   Classi rilevanti trovate ({len(classi_giocatori)}):", list(classi_giocatori)[:15])

# 3. Esempio di testo dove compare una percentuale
print("\n📝 Esempi di frammenti HTML con percentuale:")
elementi_perc = soup.find_all(text=re.compile(r'\d{1,3}\s*%'))
for el in elementi_perc[:5]:
    genitore = el.parent
    print("----------------------------------------")
    print(f"Tag: <{genitore.name} class='{genitore.get('class')}'>")
    print(f"Testo: {genitore.get_text(strip=True)}")
    if genitore.parent:
        print(f"Padre: <{genitore.parent.name} class='{genitore.parent.get('class')}'> | {genitore.parent.get_text(' ', strip=True)[:100]}")