import { NextResponse } from 'next/server';

export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  // Stampa di debug nei Runtime Logs di Vercel
  console.log('--- DEBUG GITHUB DISPATCH ---');
  console.log('GITHUB_REPO:', repo ? repo : 'MANCANTE/VUOTA');
  console.log('GITHUB_TOKEN Presente:', token ? 'SI (lunghezza ' + token.length + ')' : 'NO');

  if (!token || !repo) {
    return NextResponse.json(
      { success: false, error: `Configurazione mancante su Vercel: REPO=${repo || 'VUOTO'}, TOKEN=${token ? 'PRESENTE' : 'VUOTO'}` },
      { status: 500 }
    );
  }

  const endpoint = `https://api.github.com/repos/${repo.trim()}/dispatches`;
  console.log('Target Endpoint:', endpoint);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-App',
      },
      body: JSON.stringify({
        event_type: 'run-scraper',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API Error Response:', errorText);
      throw new Error(`Errore GitHub API (${response.status}): ${errorText}`);
    }

    return NextResponse.json({
      success: true,
      message: '🚀 Avvio dello scraper inviato con successo a GitHub Actions! Attendi qualche secondo e clicca su "Mostra Giocatori".',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}