// Tests de garde de la CLI, joués dans le processus par run(args, io) (hors seams, catalogue § 6).
// Ils protègent ce que le test de contrat ne peut pas éprouver; la grammaire, les bornes et les octets de sortie lui restent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
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

// PERF-TS-8 : F6. L'algorithme nommé s'exécute, et chaque durée est celle de son seul calcul (catalogue § 6).
// Le fib d'essai délègue au vrai et fait avancer l'horloge de son coût : rien d'autre ne la fait avancer.
// Des coûts en fractions binaires, donc des différences exactes; l'horloge ne part pas de 0, pour qu'une lecture absolue se voie.
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
