// Banc d'essai des CLI (ADR-0004) : médiane du temps total du processus et du calcul rapporté par --time.
// Usage : node contracts/bench.ts [go|rust|ts|py …] [--runs N]. Compile puis lance par contracts/lancement.ts, comme le contrat.
import { build, launch, present } from './lancement.ts';

const SCENARIOS: [name: string, args: string[]][] = [
  ['petit (10)', ['10']],
  ['terme (100000, fast)', ['100000']],
  ['terme (1000000, fast)', ['1000000']],
  ['matrix 100000', ['--algo', 'matrix', '100000']],
  ['iterative 100000', ['--algo', 'iterative', '100000']],
  ['all 100000', ['--algo', 'all', '100000']],
  ['liste 10000', ['--list', '10000']],
];

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

// Une exécution avec --time : temps total du processus, et somme des durées qu'il rapporte. Exportée pour le harnais.
export function measure(id: string, args: readonly string[]): { wall: number; calc: number } {
  // Sans stderrClosed : la commande du contrat, sans /bin/sh (contrôle du harnais).
  const r = launch(id, ['--time', ...args]);
  if (r.code !== 0) throw new Error(`${id} ${args.join(' ')} : code ${r.code}, ${r.err}`);
  const calc = r.err.split('\n').filter(Boolean).reduce((sum, line) => sum + Number(line.split(' ')[1]), 0);
  return { wall: r.ms, calc };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--runs');
  const runs = at < 0 ? 11 : Number(argv.splice(at, 2)[1]);
  const ids = argv.length ? argv : present();

  const cell = (x: number) => x.toFixed(1).padStart(8);
  console.log(`médianes sur ${runs} exécutions (ms) : total du processus / calcul selon --time`);
  console.log(`${'scénario'.padEnd(22)}${ids.map((id) => `${id.padStart(10)} total   calcul`).join('')}`);
  const table = SCENARIOS.map(([name]) => name.padEnd(22));
  for (const id of ids) {
    build(id);
    const samples = SCENARIOS.map((): { wall: number; calc: number }[] => []);
    // Le tour 0 réchauffe les caches; les scénarios s'entrelacent pour que la dérive de la machine les touche tous.
    for (let i = 0; i <= runs; i++) {
      SCENARIOS.forEach(([, args], s) => {
        const x = measure(id, args);
        if (i > 0) samples[s].push(x);
      });
    }
    samples.forEach((xs, s) => {
      table[s] += `${cell(median(xs.map((x) => x.wall)))} ${cell(median(xs.map((x) => x.calc)))}   `;
    });
  }
  console.log(table.join('\n'));
}
