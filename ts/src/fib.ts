// Calcule les termes de la suite de Fibonacci : BigInt pour un terme, addition décimale à la main pour la liste.
export type Algo = 'iterative' | 'matrix' | 'fast';

// Applique la définition indice par indice, avec deux termes consécutifs en mémoire.
function iterative(n: number): bigint {
  let [a, b] = [0n, 1n];
  // V8 n'alloue pas le tableau du pas : la variable temporaire ou deux additions par tour ne gagnent rien (mesuré).
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

// [[1,1],[1,0]]^k = [[F(k+1), F(k)], [F(k), F(k-1)]] est symétrique, et F(k-1) = F(k+1) - F(k) : on garde (a, b) seul.
function matrix(n: number): bigint {
  let a = 1n; // k = 0 : la matrice identité
  let b = 0n;
  // De gauche à droite : un carré par bit, puis un bit à 1 multiplie par Q, ce qui ne coûte que des additions.
  for (const bit of n.toString(2)) {
    [a, b] = [a * a + b * b, b * (2n * a - b)]; // carré de [[a, b], [b, a-b]]
    if (bit === '1') [a, b] = [a + b, a]; // fois [[1,1],[1,0]]
  }
  return b;
}

// Doublement rapide par les nombres de Lucas (L(0) = 2, L(1) = 1) : F(2k) = F(k)·L(k) et L(2k) = L(k)² − 2(−1)^k,
// soit un produit et un carré par bit, du poids fort au poids faible. Un bit à 1 avance d'un cran :
// F(m+1) = (F(m) + L(m)) / 2 et L(m+1) = (5F(m) + L(m)) / 2, des divisions exactes que >> 1n fait à bas prix.
function fast(n: number): bigint {
  const bits = n.toString(2);
  let f = 0n; // F(k)
  let l = 2n; // L(k)
  let sign = 1n; // (-1)^k
  for (const bit of bits.slice(0, -1)) {
    const even = f * l; // F(2k)
    const lucas = l * l - 2n * sign; // L(2k)
    if (bit === '0') [f, l, sign] = [even, lucas, 1n];
    else [f, l, sign] = [(even + lucas) >> 1n, (5n * even + lucas) >> 1n, -1n];
  }
  // Dernier bit : seul F(n) est utile, donc ni L(n) ni, pour un bit à 0, le carré.
  const even = f * l;
  return bits.endsWith('0') ? even : (even + l * l - 2n * sign) >> 1n;
}

function checkIndex(n: number): void {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`indice invalide : ${n}`);
}

const BASE = 10_000; // limbes de 4 chiffres : une somme de deux limbes et d'une retenue tient dans un int32

// Écriture ASCII de 0000 à 9999, 4 octets chacune : un limbe indexe la table, sans division ni padStart.
function asciiTable(): Uint32Array {
  const table = new Uint32Array(BASE);
  const bytes = new Uint8Array(table.buffer);
  let p = 0;
  for (let d3 = 0x30; d3 <= 0x39; d3++)
    for (let d2 = 0x30; d2 <= 0x39; d2++)
      for (let d1 = 0x30; d1 <= 0x39; d1++)
        for (let d0 = 0x30; d0 <= 0x39; d0++) {
          bytes[p++] = d3;
          bytes[p++] = d2;
          bytes[p++] = d1;
          bytes[p++] = d0;
        }
  return table;
}

/** F(0) … F(n) en décimal, une chaîne par terme, toujours par l'algorithme iterative (deux termes en mémoire).
 * L'addition décimale s'écrit à la main sur des limbes de 4 chiffres : aucune conversion binaire → décimal. */
export function fibList(n: number): string[] {
  checkIndex(n);
  const size = Math.ceil((n * 0.209) / 4) + 1; // F(n) compte moins de 0,209·n + 1 chiffres : un limbe de marge
  const a = new Int32Array(size); // F(i), limbes du poids faible au poids fort
  const b = new Int32Array(size); // F(i+1)
  b[0] = 1;
  const ascii = asciiTable();
  const words = new Uint32Array(size); // le dernier terme calculé en ASCII, aligné à droite
  const bytes = Buffer.from(words.buffer);
  let len = 1; // limbes du plus grand des deux termes, donc du dernier calculé
  // x += y en place, puis rend x en texte. Les deux termes ont len limbes au plus; le reste est à zéro.
  const add = (x: Int32Array, y: Int32Array): string => {
    let m = -1; // -1 sans retenue, 0 avec : sans branche, car la retenue est imprévisible (une fois sur deux)
    for (let k = 0; k < len; k++) {
      const u = x[k] + y[k] - (BASE - 1) + m; // somme + retenue - BASE
      m = u >> 31;
      x[k] = u + (BASE & m); // si la somme n'atteint pas BASE (m = -1), on la rend
      words[size - 1 - k] = ascii[x[k]];
    }
    if (m === 0) {
      x[len] = 1;
      words[size - 1 - len] = ascii[1];
      len++;
    }
    let start = (size - len) * 4;
    while (bytes[start] === 0x30) start++; // zéros de tête du limbe de poids fort
    return bytes.toString('latin1', start, size * 4);
  };
  const terms = ['0', '1'].slice(0, n + 1);
  for (let i = 2; i <= n; i += 2) {
    terms.push(add(a, b)); // F(i)
    if (i < n) terms.push(add(b, a)); // F(i+1)
  }
  return terms;
}

const algos: Record<Algo, (n: number) => bigint> = { iterative, matrix, fast };

/** Rend F(n) par l'algorithme algo.
 * Lève TypeError pour un algorithme inconnu, RangeError pour un indice qui n'est pas un entier >= 0. */
export function fib(n: number, algo: Algo): bigint {
  if (!Object.hasOwn(algos, algo)) throw new TypeError(`algorithme inconnu : ${algo}`);
  checkIndex(n);
  return algos[algo](n);
}
