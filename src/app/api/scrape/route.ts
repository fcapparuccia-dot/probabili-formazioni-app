import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Sostituisci questo URL con quello esatto generato da Render
    const RENDER_SCRAPER_URL = 'https://fantacalcio-scraper.onrender.com/run-scraper';

    console.log('📡 Invio richiesta di scraping al server Python su Render...');

    const response = await fetch(RENDER_SCRAPER_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Impostiamo il revalidate a 0 per evitare cache
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || 'Errore durante lo scraping su Render');
    }

    return NextResponse.json({
      success: true,
      message: 'Scraper Python eseguito con successo tramite Render!',
      data: data,
    });
  } catch (error: any) {
    console.error('❌ Errore API Scrape:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}