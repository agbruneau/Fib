// Seam 1 : la bibliothèque. Les attendus viennent de l'oracle (contracts/b000045.txt) ou de faits mathématiques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terms } from '../../contracts/oracle.ts';
import { algos, fib, fibList, type Algo } from './fib.ts';

const oracle = (n: number) => BigInt(terms()[n]);

test('BIB-01 : fib(0, iterative) vaut 0', () => {
  assert.equal(fib(0, 'iterative'), oracle(0));
});

test('BIB-02 : fib(1, iterative) vaut 1', () => {
  assert.equal(fib(1, 'iterative'), oracle(1));
});

test('BIB-03 : fib(2, iterative) vaut 1', () => {
  assert.equal(fib(2, 'iterative'), oracle(2));
});

test('BIB-04 : fib(10, iterative) vaut 55', () => {
  assert.equal(fib(10, 'iterative'), oracle(10));
});

// Un sous-test par n : un algorithme faux à n = 5 et à n = 7 rougit les deux, au lieu de s'arrêter au premier échec.
test('BIB-05 : fib(n, iterative) égale l’oracle pour n = 0..2000, au-delà d’int64 et d’uint64', async (t) => {
  for (let n = 0; n <= 2000; n++) await t.test(`n = ${n}`, () => assert.equal(fib(n, 'iterative'), oracle(n)));
});

test('BIB-06 : fib(n, fast) égale l’oracle pour n = 0..2000', async (t) => {
  for (let n = 0; n <= 2000; n++) await t.test(`n = ${n}`, () => assert.equal(fib(n, 'fast'), oracle(n)));
});

test('BIB-07 : fib(n, matrix) égale l’oracle pour n = 0..2000', async (t) => {
  for (let n = 0; n <= 2000; n++) await t.test(`n = ${n}`, () => assert.equal(fib(n, 'matrix'), oracle(n)));
});

const ALGOS: Algo[] = ['iterative', 'matrix', 'fast'];

test('BIB-08 : fib(100000, A) rend le même terme de 20 899 chiffres pour les trois algorithmes', () => {
  const [first, ...others] = ALGOS.map((a) => fib(100000, a));
  for (const t of others) assert.equal(t, first);
  assert.equal(first.toString().length, 20899);
});

for (const algo of ALGOS) {
  test(`BIB-09 : ${algo} respecte l’identité de Cassini à n = 100 000`, () => {
    const [before, at, after] = [99999, 100000, 100001].map((n) => fib(n, algo));
    assert.equal(before * after - at * at, 1n);
  });
}

// La liste rend des chaînes décimales : l'oracle les donne telles quelles.
test('BIB-10 : fibList(0) vaut ["0"]', () => {
  assert.deepEqual(fibList(0), [terms()[0]]);
});

test('BIB-11 : fibList(1) vaut ["0", "1"]', () => {
  assert.deepEqual(fibList(1), [terms()[0], terms()[1]]);
});

test('BIB-12 : fibList(2000) rend les 2 001 termes de l’oracle, dans l’ordre', () => {
  assert.deepEqual(fibList(2000), terms());
});

// hors catalogue : garde du comptage des termes de fibList (boucle à pas de 2, fin paire), pas de l'additionneur.
// Rougit : `if (i < n)` → `if (i <= n)` (un terme de trop quand n est pair) et `i += 2` → `i += 3`.
// Reste vert : la retenue `m = u >> 31` → `m = (u - 1) >> 31`, que gardent BIB-12, PERF-TS-3 à 5, CLI-L05 et CLI-L06;
// et la fin impaire `if (i < n)` → `if (i < n - 1)`, que garde PERF-TS-5 (n = 10000 est pair).
test('PERF-TS-1 : fibList(10000) rend 10 001 termes', () => {
  assert.equal(fibList(10000).length, 10001);
});

// hors catalogue : garde du limbe de poids fort du dernier terme (retenue qui sort, zéros de tête retirés).
// Rougit : `if (m === 0)` → `if (m === 1)` (la retenue qui sort du dernier limbe est perdue) et la suppression de
// `while (bytes[start] === 0x30) start++`. Pas l'additionneur : la retenue `m = u >> 31` → `m = (u - 1) >> 31` la
// laisse verte.
test('PERF-TS-2 : le dernier terme de fibList(10000) compte 2 090 chiffres', () => {
  assert.equal(fibList(10000)[10000].length, 2090);
});

// hors catalogue : garde de l'optimisation de la liste (écriture ASCII des limbes, zéros de tête retirés)
test('PERF-TS-3 : chaque terme de fibList(10000) s’écrit sans zéro de tête', () => {
  fibList(10000).forEach((term, i) => assert.match(term, /^(0|[1-9][0-9]*)$/, `n = ${i}`));
});

// hors catalogue : garde de l'optimisation de la liste (retenue propagée entre limbes de 4 chiffres)
test('PERF-TS-4 : chaque terme de fibList(10000) dès F(2) est la somme des deux précédents', () => {
  const list = fibList(10000);
  for (let i = 2; i < list.length; i++) {
    assert.equal(BigInt(list[i]), BigInt(list[i - 1]) + BigInt(list[i - 2]), `n = ${i}`);
  }
});

// hors catalogue : garde de la taille du tampon aux petits n et de la fin impaire de la boucle. Dans ts/src, seul ce
// test rougit : `Math.ceil((n * 0.209) / 4) + 1` → `Math.round((n * 0.209) / 4)` (un limbe de trop peu dès n = 2) et
// `if (i < n)` → `if (i < n - 1)`. BIB-12 et PERF-TS-1 à 4 n'éprouvent que n = 2000 et n = 10000 : pairs, et où round
// et ceil donnent le même nombre de limbes. `Math.round` avec le « + 1 » conservé est équivalent : le limbe
// d'assurance absorbe l'arrondi.
test('PERF-TS-5 : fibList(n) rend les n + 1 premiers termes de l’oracle pour chaque n de 0 à 300', () => {
  const expected = terms();
  for (let n = 0; n <= 300; n++) assert.deepEqual(fibList(n), expected.slice(0, n + 1), `n = ${n}`);
});

for (const bogus of ['all', 'bogus', '', 'FAST', 'toString']) {
  test(`BIB-13 : fib(5, ${JSON.stringify(bogus)}) est refusé`, () => {
    assert.throws(() => fib(5, bogus as Algo), { name: 'TypeError', message: /algorithme inconnu/ });
  });
}

// Un test par indice refusé : un contrôle qui laisse passer -1 et NaN rougit les deux, pas seulement -1.
const BAD_INDEXES = [-1, 1.5, NaN];

for (const algo of ALGOS) {
  for (const n of BAD_INDEXES) {
    test(`BIB-14 : fib refuse ${n} pour ${algo}`, () => {
      assert.throws(() => fib(n, algo), { name: 'RangeError', message: /indice invalide/ });
    });
  }
}

for (const n of BAD_INDEXES) {
  test(`BIB-14 : fibList refuse ${n}`, () => {
    assert.throws(() => fibList(n), { name: 'RangeError', message: /indice invalide/ });
  });
}

// hors catalogue : garde d'identité de la table `algos` (F2, F6; lacune de PERF-TS-8, qui espionne le nom demandé, pas la
// fonction rangée derrière lui). Les trois algorithmes rendent les mêmes valeurs : aucun cas de valeur ne voit un nom
// aiguillé ailleurs. Ni valeur calculée ni durée : le nom de la fonction rangée sous chaque clé, puis le début de sa source
// (une déclaration), puis l'entrée que `fib` appelle, par des espions dans la table. L'export `algos` a deux usages : les
// tests du nom la lisent, les espions y écrivent. Il est en lecture seule par le type, et seuls les espions le convertissent
// en `Record` pour écrire. Un `Object.freeze` de la table les ferait rougir à tort, leur affectation lèverait une
// TypeError, sans que `fib` ait changé.
// Rougit, par le test du nom aiguillé ailleurs, les six échanges de la table : `{ iterative: matrix, matrix, fast }`,
// `{ iterative: fast, matrix, fast }`, `{ iterative, matrix: iterative, fast }`, `{ iterative, matrix: fast, fast }`,
// `{ iterative, matrix, fast: iterative }` et `{ iterative, matrix, fast: matrix }`. Le nom seul laisse passer une
// enveloppe, car dans un littéral d'objet une fonction anonyme prend le nom de sa clé : `matrix: (n: number) => fast(n)`,
// `matrix(n: number) { return fast(n); }` et `matrix: function (n: number) { return fast(n); }`. Le début de la source,
// `function matrix(`, les rougit toutes les trois (la compilation de tsconfig.build.json l'émet de même).
for (const algo of ALGOS) {
  test(`PERF-TS-10 : la table algos range la fonction ${algo} sous le nom ${algo}`, () => {
    assert.equal(algos[algo].name, algo);
    assert.ok(algos[algo].toString().startsWith(`function ${algo}(`));
  });
}

// Rougit, par le test des deux autres noms, l'aiguillage de `fib` fixé à un nom : `algos[algo](n)` → `algos.fast(n)`,
// `algos.matrix(n)` ou `algos.iterative(n)`. Le 0n des espions n'est comparé à rien.
for (const algo of ALGOS) {
  test(`PERF-TS-10 : fib(3, ${algo}) appelle l’entrée ${algo} de la table, et elle seule`, () => {
    // Conversion explicite : `algos` est en lecture seule par le type, et ces espions sont les seuls à y écrire.
    const table = algos as Record<Algo, (n: number) => bigint>;
    const original = { ...table };
    const called: Algo[] = [];
    try {
      for (const name of ALGOS) {
        table[name] = () => {
          called.push(name);
          return 0n;
        };
      }
      fib(3, algo);
    } finally {
      Object.assign(table, original);
    }
    assert.deepEqual(called, [algo]);
  });
}
