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
  // La commande de l'implémentation, puis --time et les arguments, sans enveloppeur ni stderrClosed (HAR-1).
  const r = launch(id, ['--time', ...args]);
  if (r.code !== 0) throw new Error(`${id} ${args.join(' ')} : code ${r.code}, ${r.err}`);
  const calc = r.err.split('\n').filter(Boolean).reduce((sum, line) => sum + Number(line.split(' ')[1]), 0);
  return { wall: r.ms, calc };
}

const USAGE = 'usage : node contracts/bench.ts [go|rust|ts|py …] [--runs N]';

// Les identifiants demandés (aucun : les implémentations présentes) et le nombre d'exécutions par scénario. Toute erreur levée
// ici est une erreur d'usage. `--runs` veut des chiffres décimaux seulement : Number() accepte aussi '', ' 3', '1e3' et '0x10', et
// rend NaN, 0 ou une boucle sans fin pour le reste, que cell() découvre trop tard.
export function parseArgs(args: readonly string[]): { runs: number; ids: string[] } {
  let runs = 11;
  const ids: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--runs') {
      ids.push(args[i]);
      continue;
    }
    const value = args[++i];
    const n = Number(value);
    if (value === undefined || !/^[0-9]+$/.test(value) || !Number.isSafeInteger(n) || n < 1) {
      throw new Error(`--runs demande un entier d’au moins 1 (reçu : ${value === undefined ? 'aucune valeur' : JSON.stringify(value)})`);
    }
    runs = n;
  }
  return { runs, ids };
}

function main(argv: readonly string[]): number {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    // Avant tout build : le code 2 des erreurs d'usage de la CLI, sur stderr, sans pile.
    console.error(`bench: ${(e as Error).message}\n${USAGE}`);
    return 2;
  }
  const { runs } = parsed;
  const ids = parsed.ids.length ? parsed.ids : present();

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
  return 0;
}

// Un Node sans import.meta.main (< 22.18, 23.x, 24.0 et 24.1) laisserait le banc sans effet, en code 0 : échouer, en nommant la version
// (le garde-fou de ts/src/cli.ts, PRD § 5). L'import par le test de contrat échoue de même : il demande le même Node.
if (import.meta.main === undefined) throw new Error('le banc demande Node ^22.18 ou >=24.2 (import.meta.main est absent)');
if (import.meta.main) process.exitCode = main(process.argv.slice(2));
