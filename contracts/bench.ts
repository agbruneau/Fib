// Banc d'essai des CLI (ADR-0004) : médiane du temps total du processus et du calcul rapporté par --time.
// Usage : node contracts/bench.ts [go|rust|ts|py …] [--runs N]. Compile d'abord, avec les commandes du contrat.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const exe = process.platform === 'win32' ? '.exe' : '';

const IMPLS: Record<string, { build?: string[]; cmd: string[] }> = {
  go: { build: ['go', '-C', 'go', 'build', '-o', `../.build/fib${exe}`, './cmd/fib'], cmd: [join(root, '.build', `fib${exe}`)] },
  rust: {
    build: ['cargo', 'build', '-q', '--release', '--manifest-path', 'rust/Cargo.toml'],
    cmd: [join(root, 'rust', 'target', 'release', `fib${exe}`)],
  },
  ts: {
    build: [process.execPath, 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'],
    cmd: [process.execPath, '.build/ts/cli.js'],
  },
  py: { cmd: ['python', '-I', '-S', 'python/fib.py'] },
};

const SCENARIOS: [name: string, args: string[]][] = [
  ['petit (10)', ['10']],
  ['terme (100000, fast)', ['100000']],
  ['terme (1000000, fast)', ['1000000']],
  ['matrix 100000', ['--algo', 'matrix', '100000']],
  ['iterative 100000', ['--algo', 'iterative', '100000']],
  ['all 100000', ['--algo', 'all', '100000']],
  ['liste 10000', ['--list', '10000']],
];

const argv = process.argv.slice(2);
const at = argv.indexOf('--runs');
const runs = at < 0 ? 11 : Number(argv.splice(at, 2)[1]);
const ids = argv.length ? argv : Object.keys(IMPLS);

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

function once(id: string, args: string[]): { wall: number; calc: number } {
  const [cmd, ...head] = IMPLS[id].cmd;
  const start = process.hrtime.bigint();
  const r = spawnSync(cmd, [...head, '--time', ...args], { cwd: root, encoding: 'latin1', maxBuffer: 1 << 28 });
  const wall = Number(process.hrtime.bigint() - start) / 1e6;
  if (r.status !== 0) throw new Error(`${id} ${args.join(' ')} : code ${r.status}, ${r.stderr}${r.error ?? ''}`);
  const calc = r.stderr.split('\n').filter(Boolean).reduce((sum, line) => sum + Number(line.split(' ')[1]), 0);
  return { wall, calc };
}

const cell = (x: number) => x.toFixed(1).padStart(8);
console.log(`médianes sur ${runs} exécutions (ms) : total du processus / calcul selon --time`);
console.log(`${'scénario'.padEnd(22)}${ids.map((id) => `${id.padStart(10)} total   calcul`).join('')}`);
const table = SCENARIOS.map(([name]) => name.padEnd(22));
for (const id of ids) {
  if (!Object.hasOwn(IMPLS, id)) throw new Error(`implémentation inconnue : ${id}`);
  const build = IMPLS[id].build;
  if (build) {
    const r = spawnSync(build[0], build.slice(1), { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${build.join(' ')} a échoué : ${r.stdout}${r.stderr}${r.error ?? ''}`);
  }
  const samples = SCENARIOS.map((): { wall: number; calc: number }[] => []);
  // Le tour 0 réchauffe les caches; les scénarios s'entrelacent pour que la dérive de la machine les touche tous.
  for (let i = 0; i <= runs; i++) {
    SCENARIOS.forEach(([, args], s) => {
      const x = once(id, args);
      if (i > 0) samples[s].push(x);
    });
  }
  samples.forEach((xs, s) => {
    table[s] += `${cell(median(xs.map((x) => x.wall)))} ${cell(median(xs.map((x) => x.calc)))}   `;
  });
}
console.log(table.join('\n'));
