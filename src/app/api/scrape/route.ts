import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
  return new Promise((resolve) => {
    // Individua il percorso assoluto della radice del progetto
    const projectRoot = process.cwd();
    
    // Comando per eseguire lo script Python (adatta 'python' in 'python3' se necessario)
    const command = `python ${path.join(projectRoot, 'scraper.py')}`;

    exec(command, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Errore esecuzione scraper.py: ${error.message}`);
        console.error(`Stderr: ${stderr}`);
        return resolve(
          NextResponse.json(
            { success: false, error: stderr || error.message },
            { status: 500 }
          )
        );
      }

      console.log(`Output scraper.py: ${stdout}`);
      return resolve(
        NextResponse.json({
          success: true,
          message: 'Scraper Python eseguito con successo!',
          output: stdout,
        })
      );
    });
  });
}