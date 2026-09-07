import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const maxDuration = 60;

export async function GET() {
  try {
    const url = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(html);

    // Diagnostica: raccoglie tutti gli h1, h2, h3, h4 e le prime classi principali della pagina
    const titoli: string[] = [];
    $('h1, h2, h3, h4, .title').each((_, el) => {
      const txt = $(el).text().trim();
      if (txt) titoli.push(txt);
    });

    // Raccoglie i primi elementi che contengono nomi di squadre conosciute
    const squadreTrovate: string[] = [];
    const SQUADRE = ['INTER', 'MILAN', 'JUVENTUS', 'NAPOLI', 'ROMA', 'LAZIO', 'ATALANTA', 'GENOA'];
    
    $('*').each((_, el) => {
      const text = $(el).text().toUpperCase();
      SQUADRE.forEach((sq) => {
        if (text.includes(sq) && $(el).children().length === 0) {
          squadreTrovate.push(`Tag: ${el.tagName}, Class: ${$(el).attr('class') || 'nessuna'}, Testo: ${$(el).text().trim()}`);
        }
      });
    });

    return NextResponse.json({
      success: true,
      lunghezzaHtml: html.length,
      titoliTrovati: titoli.slice(0, 15),
      campioneNodiSquadra: squadreTrovate.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}