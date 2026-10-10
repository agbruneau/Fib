export type Algo = 'iterative' | 'matrix' | 'fast';

function iterative(n: number): bigint {
  let [a, b] = [0n, 1n];
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

// Doublement rapide : à chaque bit de n, (F(k), F(k+1)) devient (F(2k), F(2k+1)); un bit à 1 avance encore d'un cran.
function fast(n: number): bigint {
  let [a, b] = [0n, 1n];
  for (const bit of n.toString(2)) {
    const c = a * (2n * b - a);
    const d = a * a + b * b;
    [a, b] = bit === '1' ? [d, c + d] : [c, d];
  }
  return a;
}

// [[1,1],[1,0]]^n = [[F(n+1), F(n)], [F(n), F(n-1)]], par carrés successifs. Matrice 2x2 à plat : [a, b, c, d].
type Mat = [bigint, bigint, bigint, bigint];
const mul = (x: Mat, y: Mat): Mat => [
  x[0] * y[0] + x[1] * y[2], x[0] * y[1] + x[1] * y[3],
  x[2] * y[0] + x[3] * y[2], x[2] * y[1] + x[3] * y[3],
];

function matrix(n: number): bigint {
  let result: Mat = [1n, 0n, 0n, 1n];
  let base: Mat = [1n, 1n, 1n, 0n];
  for (let k = BigInt(n); k > 0n; k >>= 1n) {
    if (k & 1n) result = mul(result, base);
    base = mul(base, base);
  }
  return result[1];
}

function checkIndex(n: number): void {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`indice invalide : ${n}`);
}

/** F(0) … F(n), toujours par l'algorithme iterative. */
export function fibList(n: number): bigint[] {
  checkIndex(n);
  const terms = [0n];
  let [a, b] = [0n, 1n];
  for (let i = 0; i < n; i++) {
    [a, b] = [b, a + b];
    terms.push(a);
  }
  return terms;
}

const algos: Record<Algo, (n: number) => bigint> = { iterative, matrix, fast };

export function fib(n: number, algo: Algo): bigint {
  if (!Object.hasOwn(algos, algo)) throw new TypeError(`algorithme inconnu : ${algo}`);
  checkIndex(n);
  return algos[algo](n);
}
