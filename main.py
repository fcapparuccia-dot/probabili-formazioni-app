import os
from flask import Flask, jsonify
import scraper  # Importa la logica dal tuo scraper.py

app = Flask(__name__)

@app.route('/run-scraper', methods=['GET', 'POST'])
def trigger_scraper():
    try:
        print("🚀 Avvio scraping richiesto via API...")
        dati = scraper.scarica_probabili_formazioni()
        if dati:
            scraper.salva_su_supabase(dati)
            return jsonify({"success": True, "message": f"Estratti e salvati {len(dati)} giocatori!"}), 200
        else:
            return jsonify({"success": False, "message": "Nessun dato estratto"}), 500
    except Exception as e:
        print(f"❌ Errore durante lo scraping: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
