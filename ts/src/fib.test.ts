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

test('BIB-10 : fibList(0) vaut [0]', () => {
  assert.deepEqual(fibList(0), [oracle(0)]);
});

test('BIB-11 : fibList(1) vaut [0, 1]', () => {
  assert.deepEqual(fibList(1), [oracle(0), oracle(1)]);
});

test('BIB-12 : fibList(2000) rend les 2 001 termes de l’oracle, dans l’ordre', () => {
  assert.deepEqual(fibList(2000), terms().map(BigInt));
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
