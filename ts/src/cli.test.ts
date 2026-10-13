// Tests de garde de la CLI, joués dans le processus par run(args, io) (hors seams, catalogue § 6), sauf PERF-TS-9, qui lance la CLI compilée.
// Ils protègent ce que le test de contrat ne peut pas éprouver; la grammaire, les bornes et les octets de sortie lui restent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { terms } from '../../contracts/oracle.ts';
import { fib, type Algo } from './fib.ts';
import { run, type Io } from './cli.ts';

// Un Io d'essai : chaque écriture est enregistrée, flux par flux. Sans substitut, fib est le vrai et l'horloge reste figée.
function harness(substitutes: Partial<Pick<Io, 'fib' | 'clock'>> = {}) {
  const stdout: [text: string, encoding: string][] = [];
  const stderr: string[] = [];
  const io: Io = {
    fib,
    clock: () => 0,
    stdout: { write: (text, encoding) => stdout.push([text, encoding]) },
    stderr: { write: (text) => stderr.push(text) },
    ...substitutes,
  };
  return { io, stdout, stderr };
}

// PERF-TS-6 : l'écriture unique de stdout (ADR-0004). Une écriture par ligne coûte cher sur --list, et le contrat ne voit pas les appels.
const SINGLE_WRITE: [args: string[], expected: () => string][] = [
  [['--list', '300'], () => terms().slice(0, 301).join('\n') + '\n'],
  [['--time', '--algo', 'all', '300'], () => terms()[300] + '\n'],
];

for (const [args, expected] of SINGLE_WRITE) {
  test(`PERF-TS-6 : ${args.join(' ')} écrit tout stdout en un seul appel, en latin1`, () => {
    const { io, stdout } = harness();
    assert.equal(run(args, io), 0);
    assert.deepEqual(stdout, [[expected(), 'latin1']]);
  });
}

// PERF-TS-7 : F3. Le seul usage d'un fib substitué : le vrai terme, plus 1 pour un algorithme, tour à tour à chacune des trois places.
// Aucun cas CLI ne peut provoquer une discordance (catalogue § 6), et le test ne recalcule aucun terme.
for (const bad of ['fast', 'iterative', 'matrix'] as const) {
  test(`PERF-TS-7 : si ${bad} diffère des deux autres, --time --algo all 10 rend 3, sans stdout et sans durée`, () => {
    const { io, stdout, stderr } = harness({ fib: (n, algo) => fib(n, algo) + (algo === bad ? 1n : 0n) });
    assert.equal(run(['--time', '--algo', 'all', '10'], io), 3);
    assert.deepEqual(stdout, [], 'aucune écriture sur stdout');
    assert.equal(stderr.length, 1, 'un seul appel à stderr');
    assert.match(stderr[0], /^fib: [^\n]*\n$/);
  });
}

// PERF-TS-8 : F6 (catalogue § 6). L'algorithme nommé s'exécute, une ligne par algorithme exécuté, dans l'ordre, en un seul appel
// à stderr, et chaque durée est l'écart de deux lectures de l'horloge autour de son calcul.
// Le test ne vérifie pas l'étendue exacte de cette fenêtre : l'horloge d'essai n'avance que dans fib, donc une fenêtre qui
// engloberait aussi la mise en forme du terme passerait.
// Le fib d'essai délègue au vrai et fait avancer l'horloge de son coût. Des coûts en fractions binaires, donc des différences
// exactes; l'horloge ne part pas de 0, pour qu'une lecture absolue se voie.
const COST: Record<Algo, [ms: number, line: string]> = {
  fast: [0.5, 'fast 0.500 ms\n'],
  iterative: [1.25, 'iterative 1.250 ms\n'],
  matrix: [2.125, 'matrix 2.125 ms\n'],
};

const EXECUTED: [args: string[], algos: Algo[]][] = [
  [['10'], ['fast']],
  [['--algo', 'iterative', '10'], ['iterative']],
  [['--algo', 'matrix', '10'], ['matrix']],
  [['--algo', 'all', '10'], ['fast', 'iterative', 'matrix']],
];

for (const [args, algos] of EXECUTED) {
  test(`PERF-TS-8 : --time ${args.join(' ')} exécute ${algos.join(' puis ')} et rapporte le coût de chacun, en un seul appel à stderr`, () => {
    let now = 100;
    const calls: Algo[] = [];
    const { io, stderr } = harness({
      clock: () => now,
      fib: (n, algo) => {
        calls.push(algo);
        now += COST[algo][0];
        return fib(n, algo);
      },
    });
    assert.equal(run(['--time', ...args], io), 0);
    assert.deepEqual(calls, algos, 'les algorithmes exécutés, dans l’ordre');
    assert.deepEqual(stderr, [algos.map((a) => COST[a][1]).join('')]);
  });
}

// --list n'appelle pas fib : sa durée vient de l'horloge seule. Elle avance de 0,5 ms à chaque lecture, donc la durée est
// exactement l'écart de deux lectures, et la ligne ne peut pas être écrite en dur.
test('PERF-TS-8 : --time --list 10 rapporte iterative, et sa durée est l’écart de deux lectures de l’horloge', () => {
  let now = 100;
  const { io, stderr } = harness({ clock: () => (now += 0.5) });
  assert.equal(run(['--time', '--list', '10'], io), 0);
  assert.equal(now, 101, 'deux lectures');
  assert.deepEqual(stderr, ['iterative 0.500 ms\n']);
});

// L'horloge est appelée en méthode de l'Io : une horloge à état, qui lit this, fonctionne. Détachée, elle lèverait.
test('PERF-TS-8 : l’horloge est appelée en méthode de l’Io, this compris', () => {
  const { io, stderr } = harness();
  const stateful = Object.assign(io, {
    now: 100,
    clock(this: { now: number }) {
      return (this.now += 0.5);
    },
  });
  assert.equal(run(['--time', '10'], stateful), 0);
  assert.deepEqual(stderr, ['fast 0.500 ms\n']);
});

// PERF-TS-9 : la CLI ne charge pas `performance` (ADR-0004, #21). Son premier accès charge neuf modules (perf_hooks, sept
// internal/perf/… et internal/histogram), et timed lit l'horloge même sans --time : la garde éprouve donc `10` comme `--time 10`.
// Elle joue la CLI compilée dans un sous-processus : celui de test a pu charger perf_hooks lui-même. Un module de `--import`
// y écrit process.moduleLoadList sur stderr à la sortie; stdout, le code et la ligne de durée restent ceux de la CLI.
// Trois internal/perf/… ne viennent pas du global : utils au démarrage de Node, performance_entry et observe par net dès
// que stdout est un tube (mesuré sous Node 22.22, avec la CLI corrigée). Toute autre entrée perf, perf_hooks compris, est interdite.
// Le témoin vérifie que le crochet et le filtre voient bien performance se charger.
// Rouge sous le mutant `clock: () => performance.now()` dans processIo (cli.ts), ou sous un import de node:perf_hooks.
const root = fileURLToPath(new URL('../..', import.meta.url));
// Dossier à part de .build/ts : une exécution du contrat ou du banc en parallèle ne lit jamais un cli.js en cours d'écriture.
const outDir = join(root, '.build', 'ts-garde');
const MARK = 'moduleLoadList:';
const HOOK =
  'data:text/javascript,' +
  encodeURIComponent(
    `import{writeSync}from'node:fs';process.on('exit',()=>writeSync(2,${JSON.stringify(MARK)}+JSON.stringify(process.moduleLoadList)+'\\n'))`,
  );
const NOT_FROM_PERFORMANCE = ['internal/perf/utils', 'internal/perf/performance_entry', 'internal/perf/observe'];
const perfModules = (modules: string[]) =>
  modules.filter((m) => /\bperf_hooks$|\binternal\/perf\//.test(m) && !NOT_FROM_PERFORMANCE.some((ok) => m.endsWith(ok)));

let compiled = false;
function compile() {
  if (compiled) return;
  // Même commande que le contrat (PRD § 5), vers outDir.
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  const r = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.build.json', '--outDir', outDir], { cwd: root, encoding: 'latin1' });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  compiled = true;
}

// Lance node avec le crochet; rend stdout, stderr sans la liste du crochet, et la liste.
function launch(args: string[]) {
  const r = spawnSync(process.execPath, ['--import', HOOK, ...args], { cwd: root, encoding: 'latin1' });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr);
  const at = r.stderr.lastIndexOf(MARK);
  assert.notEqual(at, -1, 'le crochet n’a rien écrit sur stderr');
  return { stdout: r.stdout, stderr: r.stderr.slice(0, at), modules: JSON.parse(r.stderr.slice(at + MARK.length)) as string[] };
}

const NO_PERF: [args: string[], stderr: RegExp][] = [
  [['--time', '10'], /^fast \d+\.\d{3} ms\n$/],
  [['10'], /^$/],
];

for (const [args, stderr] of NO_PERF) {
  test(`PERF-TS-9 : ${args.join(' ')} ne charge ni perf_hooks ni internal/perf/…, et la sortie reste celle de la CLI`, () => {
    compile();
    const r = launch([join(outDir, 'cli.js'), ...args]);
    assert.equal(r.stdout, '55\n');
    assert.match(r.stderr, stderr);
    assert.deepEqual(perfModules(r.modules), []);
  });
}

test('PERF-TS-9 : témoin, le crochet voit performance charger perf_hooks', () => {
  const loaded = perfModules(launch(['-e', 'performance.now()']).modules);
  assert.ok(loaded.some((m) => m.endsWith('perf_hooks')), `perf_hooks absent de ${loaded.join(', ')}`);
  assert.ok(loaded.some((m) => m.includes('internal/perf/performance')), `internal/perf/performance absent de ${loaded.join(', ')}`);
});
