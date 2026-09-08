import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execPromise = util.promisify(exec);

export async function POST() {
  try {
    // Percorso assoluto verso la radice del progetto per evitare errori di directory
    const scriptPath = path.join(process.cwd(), 'scraper.py');
    
    // Su Windows usa 'python', su Linux/Mac 'python3'
    const command = process.platform === 'win32' ? `python "${scriptPath}"` : `python3 "${scriptPath}"`;

    const { stdout, stderr } = await execPromise(command);

    if (stderr && !stdout) {
      console.error('Errore dallo script Python:', stderr);
      return NextResponse.json(
        { success: false, error: stderr },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Scraping completato con successo',
      output: stdout,
    });
  } catch (error: any) {
    console.error('Errore di esecuzione API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}