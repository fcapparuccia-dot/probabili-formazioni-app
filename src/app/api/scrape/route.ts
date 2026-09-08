import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST() {
  try {
    const { stdout, stderr } = await execPromise('python3 scraper.py');

    if (stderr && !stdout) {
      console.error('Errore scraper:', stderr);
      return NextResponse.json({ success: false, error: stderr }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Scraping completato',
      output: stdout,
    });
  } catch (error: any) {
    console.error('Errore esecuzione:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}