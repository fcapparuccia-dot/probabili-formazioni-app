import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execPromise = util.promisify(exec);

export async function POST() {
  try {
    const scriptPath = path.join(process.cwd(), 'scraper.py');
    const command = process.platform === 'win32' ? `python "${scriptPath}"` : `python3 "${scriptPath}"`;

    const { stdout, stderr } = await execPromise(command);

    if (stderr && !stdout) {
      console.error('Errore durante lo scraping:', stderr);
      return NextResponse.json(
        { success: false, error: stderr },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Scraping ed aggiornamento completati con successo!',
      output: stdout,
    });
  } catch (error: any) {
    console.error('Errore esecuzione scraper.py:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Errore durante l\'esecuzione dello script.' 
      },
      { status: 500 }
    );
  }
}