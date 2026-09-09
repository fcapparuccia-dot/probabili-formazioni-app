export type Modulo = '3-4-3' | '3-5-2' | '4-3-3' | '4-4-2' | '4-5-1' | '5-3-2' | '5-4-1' | '5-2-3';

// Posizioni relative percentuali (top%, left%) sul campo da gioco
export const POSIZIONI_SCHEMI: Record<Modulo, { top: string; left: string }[]> = {
  '4-3-3': [
    { top: '88%', left: '50%' }, // Por
    { top: '70%', left: '15%' }, { top: '72%', left: '38%' }, { top: '72%', left: '62%' }, { top: '70%', left: '85%' }, // Difesa
    { top: '48%', left: '25%' }, { top: '50%', left: '50%' }, { top: '48%', left: '75%' }, // Centrocampo
    { top: '22%', left: '20%' }, { top: '18%', left: '50%' }, { top: '22%', left: '80%' }  // Attacco
  ],
  '3-5-2': [
    { top: '88%', left: '50%' },
    { top: '72%', left: '25%' }, { top: '74%', left: '50%' }, { top: '72%', left: '75%' },
    { top: '48%', left: '12%' }, { top: '50%', left: '31%' }, { top: '52%', left: '50%' }, { top: '50%', left: '69%' }, { top: '48%', left: '88%' },
    { top: '20%', left: '35%' }, { top: '20%', left: '65%' }
  ],
  '3-4-3': [
    { top: '88%', left: '50%' },
    { top: '72%', left: '25%' }, { top: '74%', left: '50%' }, { top: '72%', left: '75%' },
    { top: '50%', left: '18%' }, { top: '52%', left: '39%' }, { top: '52%', left: '61%' }, { top: '50%', left: '82%' },
    { top: '22%', left: '20%' }, { top: '18%', left: '50%' }, { top: '22%', left: '80%' }
  ],
  '4-4-2': [
    { top: '88%', left: '50%' },
    { top: '70%', left: '15%' }, { top: '72%', left: '38%' }, { top: '72%', left: '62%' }, { top: '70%', left: '85%' },
    { top: '50%', left: '15%' }, { top: '52%', left: '38%' }, { top: '52%', left: '62%' }, { top: '50%', left: '85%' },
    { top: '20%', left: '35%' }, { top: '20%', left: '65%' }
  ],
  '4-5-1': [
    { top: '88%', left: '50%' },
    { top: '70%', left: '15%' }, { top: '72%', left: '38%' }, { top: '72%', left: '62%' }, { top: '70%', left: '85%' },
    { top: '50%', left: '12%' }, { top: '52%', left: '31%' }, { top: '54%', left: '50%' }, { top: '52%', left: '69%' }, { top: '50%', left: '88%' },
    { top: '18%', left: '50%' }
  ],
  '5-3-2': [
    { top: '88%', left: '50%' },
    { top: '70%', left: '10%' }, { top: '72%', left: '30%' }, { top: '74%', left: '50%' }, { top: '72%', left: '70%' }, { top: '70%', left: '90%' },
    { top: '50%', left: '25%' }, { top: '52%', left: '50%' }, { top: '50%', left: '75%' },
    { top: '20%', left: '35%' }, { top: '20%', left: '65%' }
  ],
  '5-4-1': [
    { top: '88%', left: '50%' },
    { top: '70%', left: '10%' }, { top: '72%', left: '30%' }, { top: '74%', left: '50%' }, { top: '72%', left: '70%' }, { top: '70%', left: '90%' },
    { top: '50%', left: '15%' }, { top: '52%', left: '38%' }, { top: '52%', left: '62%' }, { top: '50%', left: '85%' },
    { top: '18%', left: '50%' }
  ],
  '5-2-3': [
    { top: '88%', left: '50%' },
    { top: '70%', left: '10%' }, { top: '72%', left: '30%' }, { top: '74%', left: '50%' }, { top: '72%', left: '70%' }, { top: '70%', left: '90%' },
    { top: '52%', left: '35%' }, { top: '52%', left: '65%' },
    { top: '22%', left: '20%' }, { top: '18%', left: '50%' }, { top: '22%', left: '80%' }
  ]
};