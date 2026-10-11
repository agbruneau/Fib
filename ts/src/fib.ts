// Calcule les termes de la suite de Fibonacci en précision arbitraire (BigInt).
export type Algo = 'iterative' | 'matrix' | 'fast';

// Applique la définition indice par indice, avec deux termes consécutifs en mémoire.
function iterative(n: number): bigint {
  let [a, b] = [0n, 1n];
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

// Matrice 2x2 à plat : [a, b, c, d].
type Mat = [bigint, bigint, bigint, bigint];
const mul = ([a, b, c, d]: Mat, [e, f, g, h]: Mat): Mat => [a * e + b * g, a * f + b * h, c * e + d * g, c * f + d * h];

// [[1,1],[1,0]]^n = [[F(n+1), F(n)], [F(n), F(n-1)]], par carrés successifs.
function matrix(n: number): bigint {
  let result: Mat = [1n, 0n, 0n, 1n];
  let base: Mat = [1n, 1n, 1n, 0n];
  // BigInt : >> sur un number tronque à 32 bits.
  for (let k = BigInt(n); k > 0n; k >>= 1n) {
    if (k & 1n) result = mul(result, base);
    base = mul(base, base);
  }
  return result[1];
}

// Doublement rapide : les bits de n, lus du poids fort au poids faible, font passer de (F(k), F(k+1)) à (F(2k), F(2k+1)); un bit à 1 avance encore d'un cran.
function fast(n: number): bigint {
  let [a, b] = [0n, 1n];
  for (const bit of n.toString(2)) {
    const even = a * (2n * b - a); // F(2k) = F(k)·(2F(k+1) − F(k))
    const odd = a * a + b * b; // F(2k+1) = F(k)² + F(k+1)²
    [a, b] = bit === '1' ? [odd, even + odd] : [even, odd];
  }
  return a;
}

function checkIndex(n: number): void {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`indice invalide : ${n}`);
}

/** F(0) … F(n), toujours par l'algorithme iterative. */
export function fibList(n: number): bigint[] {
  checkIndex(n);
  let [a, b] = [0n, 1n];
  const terms = [a];
  for (let i = 0; i < n; i++) {
    [a, b] = [b, a + b];
    terms.push(a);
  }
  return terms;
}

const algos: Record<Algo, (n: number) => bigint> = { iterative, matrix, fast };

/** Rend F(n) par l'algorithme algo. Lève TypeError pour un algorithme inconnu, RangeError pour un indice qui n'est pas un entier >= 0. */
export function fib(n: number, algo: Algo): bigint {
  if (!Object.hasOwn(algos, algo)) throw new TypeError(`algorithme inconnu : ${algo}`);
  checkIndex(n);
  return algos[algo](n);
}
