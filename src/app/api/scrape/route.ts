import { NextResponse } from 'next/server';

export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    return NextResponse.json(
      { success: false, error: 'Variabili GITHUB_TOKEN o GITHUB_REPO non configurate su Vercel.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'run-scraper',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
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