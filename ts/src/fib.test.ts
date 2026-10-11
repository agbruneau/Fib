// Seam 1 : la bibliothèque. Les attendus viennent de l'oracle (contracts/b000045.txt) ou de faits mathématiques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terms } from '../../contracts/oracle.ts';
import { fib, fibList, type Algo } from './fib.ts';

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

test('BIB-05 : fib(n, iterative) égale l’oracle pour n = 0..2000, au-delà d’int64 et d’uint64', () => {
  for (let n = 0; n <= 2000; n++) assert.equal(fib(n, 'iterative'), oracle(n), `n = ${n}`);
});

test('BIB-06 : fib(n, fast) égale l’oracle pour n = 0..2000', () => {
  for (let n = 0; n <= 2000; n++) assert.equal(fib(n, 'fast'), oracle(n), `n = ${n}`);
});

test('BIB-07 : fib(n, matrix) égale l’oracle pour n = 0..2000', () => {
  for (let n = 0; n <= 2000; n++) assert.equal(fib(n, 'matrix'), oracle(n), `n = ${n}`);
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

// hors catalogue : garde de l'optimisation de la liste (additionneur décimal en limbes de 4 chiffres)
test('PERF-TS-1 : fibList(10000) rend 10 001 termes', () => {
  assert.equal(fibList(10000).length, 10001);
});

// hors catalogue : garde de l'optimisation de la liste (additionneur décimal en limbes de 4 chiffres)
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

// hors catalogue : garde de l'optimisation de la liste (tampon de taille calculée d'après n, marge mince aux petits n)
test('PERF-TS-5 : fibList(n) rend les n + 1 premiers termes de l’oracle pour chaque n de 0 à 300', () => {
  const expected = terms();
  for (let n = 0; n <= 300; n++) assert.deepEqual(fibList(n), expected.slice(0, n + 1), `n = ${n}`);
});

for (const bogus of ['all', 'bogus', '', 'FAST', 'toString']) {
  test(`BIB-13 : fib(5, ${JSON.stringify(bogus)}) est refusé`, () => {
    assert.throws(() => fib(5, bogus as Algo), { name: 'TypeError', message: /algorithme inconnu/ });
  });
}

for (const algo of ALGOS) {
  test(`BIB-14 : fib refuse -1, 1.5 et NaN pour ${algo}`, () => {
    for (const n of [-1, 1.5, NaN]) {
      assert.throws(() => fib(n, algo), { name: 'RangeError', message: /indice invalide/ }, `n = ${n}`);
    }
  });
}

test('BIB-14 : fibList refuse -1, 1.5 et NaN', () => {
  for (const n of [-1, 1.5, NaN]) {
    assert.throws(() => fibList(n), { name: 'RangeError', message: /indice invalide/ }, `n = ${n}`);
  }
});
