// Test de contrat : vérifie l'oracle, puis joue les cas CLI de docs/cas-de-test.md sur chaque implémentation.
// Usage : node contracts/cli.test.ts [go|rust|ts|py …]
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKS, lines, terms } from './oracle.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const exe = process.platform === 'win32' ? '.exe' : '';

// Lancement depuis la racine (PRD § 5). Go, Rust et TS passent par un build fait une fois (BUILDS), pour mesurer le
// programme et non son démarrage. Python : `-I -S` saute `site` et PYTHON*, sans changer la sortie de la CLI.
const IMPLS: Record<string, { dir: string; cmd: string[] }> = {
  go: { dir: 'go', cmd: [join(root, '.build', `fib${exe}`)] },
  rust: { dir: 'rust', cmd: [join(root, 'rust', 'target', 'release', `fib${exe}`)] },
  ts: { dir: 'ts', cmd: [process.execPath, '.build/ts/cli.js'] },
  py: { dir: 'python', cmd: ['python', '-I', '-S', 'python/fib.py'] },
};

// Compilation préalable, jouée une fois par groupe. tsc 7 est lancé par le point d'entrée JS du paquet :
// `.bin/tsc` n'est pas exécutable sans shell sous Windows.
const BUILDS: Record<string, string[]> = {
  go: ['go', '-C', 'go', 'build', '-o', `../.build/fib${exe}`, './cmd/fib'],
  rust: ['cargo', 'build', '-q', '--release', '--manifest-path', 'rust/Cargo.toml'],
  ts: [process.execPath, 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'],
};

const USAGE = `usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
`;

// 'erreur' : code 2, stdout vide, une seule ligne `fib: …`. Sinon code 0 : `out` exact et/ou `check`, `times` = algos chronométrés.
type Want = 'erreur' | { out?: string | (() => string); check?: (out: string) => void; times?: string[] };
type Case = [id: string, title: string, args: string[], want: Want, env?: Record<string, string>];

// term et list sont paresseux : un oracle absent ne fait échouer que les cas qui en tirent leur attendu (catalogue § 3).
const term = (k: number) => () => `${terms()[k]}\n`;
const list = (n: number) => () => terms().slice(0, n + 1).map((t) => `${t}\n`).join('');

function run(id: string, args: string[], env: Record<string, string | undefined> = {}) {
  const [cmd, ...head] = IMPLS[id].cmd;
  const r = spawnSync(cmd, [...head, ...args], {
    cwd: root, env: { ...process.env, ...env },
    // latin1 : un octet égale un caractère, donc X-2, X-4 et les longueurs voient les octets bruts.
    encoding: 'latin1',
    // `--list 10000` écrit environ 10,5 Mo, au-delà du défaut.
    maxBuffer: 1 << 28,
    // Filet contre une CLI qui boucle.
    timeout: 300_000,
  });
  assert.ifError(r.error);
  return { code: r.status, out: r.stdout, err: r.stderr };
}

// Assertions communes X-1 à X-4.
function verify(r: ReturnType<typeof run>, want: Want): void {
  const ctx = `code ${r.code}, stderr ${JSON.stringify(r.err.slice(0, 200))}`;
  const ascii = () => assert.ok(/^[\n\x20-\x7e]*$/.test(r.out + r.err), 'X-4 : sortie non ASCII, ou avec \\r ou ESC');
  if (want === 'erreur') {
    assert.equal(r.code, 2, `X-1 : ${ctx}`);
    assert.match(r.err, /^fib: [^\n]*\n$/, 'X-3 : une seule ligne « fib: … »');
    assert.equal(r.out, '', 'X-2 : stdout vide');
    return ascii();
  }
  assert.equal(r.code, 0, `X-1 : ${ctx}`);
  const got = r.err.split('\n');
  assert.equal(got.pop(), '', `X-3 : stderr se termine par \\n (${ctx})`);
  got.forEach((l) => assert.match(l, /^(fast|iterative|matrix) [0-9]+\.[0-9]{3} ms$/, 'X-3 : ligne de durée'));
  assert.deepEqual(got.map((l) => l.split(' ')[0]), want.times ?? [], 'X-3 : algorithmes chronométrés');
  ascii();
  const exact = typeof want.out === 'function' ? want.out() : want.out;
  if (exact !== undefined) assert.equal(r.out, exact, 'X-2');
  want.check?.(r.out);
}

// Partagé par CLI-T12 et CLI-T13 : F(k) divise F(mk), donc F(2000) divise F(100 000) et F(1 000 000) (catalogue § 2).
// F(2000) vient de l'oracle. Reste lu par tranches de 18 chiffres, sans la conversion quadratique décimal → BigInt.
const checkDivisibleByF2000 = (out: string) => {
  const f = BigInt(terms()[2000]);
  const digits = out.slice(0, -1);
  const padded = digits.padStart(Math.ceil(digits.length / 18) * 18, '0');
  const tranche = 10n ** 18n;
  let r = 0n;
  for (let i = 0; i < padded.length; i += 18) r = (r * tranche + BigInt(padded.slice(i, i + 18))) % f;
  assert.ok(r === 0n, 'la sortie n’est pas divisible par F(2000)');
};

const T: Case[] = [
  ['CLI-T01', '10 écrit F(10)', ['10'], { out: term(10) }],
  ['CLI-T02', '0 écrit F(0)', ['0'], { out: term(0) }],
  ['CLI-T03', '1 écrit F(1)', ['1'], { out: term(1) }],
  ['CLI-T04', '2 écrit F(2)', ['2'], { out: term(2) }],
  ['CLI-T05', '92 écrit F(92), dernier terme d’un int64', ['92'], { out: term(92) }],
  ['CLI-T06', '93 écrit F(93), dernier terme d’un uint64', ['93'], { out: term(93) }],
  ['CLI-T07', '94 écrit F(94), au-delà d’un uint64', ['94'], { out: term(94) }],
  ['CLI-T08', '1000 écrit F(1000)', ['1000'], { out: term(1000) }],
  ['CLI-T09', '2000 écrit F(2000)', ['2000'], { out: term(2000) }],
  ['CLI-T10', 'des zéros de tête sont permis : 007 vaut 7', ['007'], { out: term(7) }],
  ['CLI-T11', 'de nombreux zéros de tête : …010 vaut 10', ['00000000000000000000000000010'], { out: term(10) }],
  ['CLI-T12', '100000 écrit un terme de 20 899 chiffres, congru à F(1696) mod 2048 et à F(1000) mod 1000, divisible par F(2000)', ['100000'], {
    check: (out) => {
      assert.match(out, /^[1-9][0-9]*\n$/);
      assert.equal(out.length - 1, 20899);
      const t = BigInt(out);
      assert.equal(t % 2048n, BigInt(terms()[1696]) % 2048n);
      assert.equal(t % 1000n, BigInt(terms()[1000]) % 1000n);
      checkDivisibleByF2000(out);
    },
  }],
  ['CLI-T13', '1000000 écrit un terme de 208 988 chiffres, congru à F(1600) mod 2048 et à F(1000) mod 1000, divisible par F(2000)', ['1000000'], {
    check: (out) => {
      assert.match(out, /^[1-9][0-9]*\n$/);
      assert.equal(out.length - 1, 208988);
      // Restes lus chiffre à chiffre : évite la conversion décimal → BigInt, quadratique, de 208 988 chiffres.
      const mod = (m: number) => [...out.slice(0, -1)].reduce((r, c) => (r * 10 + Number(c)) % m, 0);
      assert.equal(mod(2048), Number(BigInt(terms()[1600]) % 2048n));
      assert.equal(mod(1000), Number(BigInt(terms()[1000]) % 1000n));
      checkDivisibleByF2000(out);
    },
  }],
  ['CLI-T14', '5 000 zéros de tête, puis 5, valent 5', ['0'.repeat(5000) + '5'], { out: term(5) }],
];

const I: Case[] = [
  ['CLI-I01', 'aucun argument : indice absent', [], 'erreur'],
  ['CLI-I02', 'un argument vide est refusé', [''], 'erreur'],
  ['CLI-I03', 'abc n’est pas un nombre', ['abc'], 'erreur'],
  ['CLI-I04', 'un décimal est refusé', ['1.5'], 'erreur'],
  ['CLI-I05', 'un signe + est refusé', ['+5'], 'erreur'],
  ['CLI-I06', 'un soulignement est refusé', ['1_000'], 'erreur'],
  ['CLI-I07', 'un hexadécimal est refusé', ['0x10'], 'erreur'],
  ['CLI-I08', 'une espace de tête est refusée', [' 5'], 'erreur'],
  ['CLI-I09', 'une espace de queue est refusée', ['5 '], 'erreur'],
  ['CLI-I10', 'un chiffre non ASCII est refusé', ['٣'], 'erreur'],
  ['CLI-I11', '-1 est une option inconnue', ['-1'], 'erreur'],
  ['CLI-I12', '1000001 dépasse la borne d’un terme', ['1000001'], 'erreur'],
  ['CLI-I13', 'la borne s’applique malgré les zéros de tête', ['000000000000000000000000001000001'], 'erreur'],
  ['CLI-I14', 'un indice trop grand pour un entier natif est une erreur, pas une panique', ['99999999999999999999'], 'erreur'],
  ['CLI-I15', 'deux indices sont refusés', ['5', '6'], 'erreur'],
  ['CLI-I16', 'un saut de ligne après l’indice est refusé', ['5\n'], 'erreur'],
  ['CLI-I17', 'une espace entre deux nombres, dans un seul argument, est refusée', ['5 6'], 'erreur'],
];

const A: Case[] = [
  ['CLI-A01', '--algo iterative écrit F(2000)', ['--algo', 'iterative', '2000'], { out: term(2000) }],
  ['CLI-A02', '--algo matrix écrit F(2000)', ['--algo', 'matrix', '2000'], { out: term(2000) }],
  ['CLI-A03', '--algo fast écrit F(2000)', ['--algo', 'fast', '2000'], { out: term(2000) }],
  ['CLI-A04', '--algo all écrit F(2000) une seule fois', ['--algo', 'all', '2000'], { out: term(2000) }],
  ['CLI-A05', '--algo all 0 écrit F(0)', ['--algo', 'all', '0'], { out: term(0) }],
  ['CLI-A06', '--algo=matrix équivaut à --algo matrix', ['--algo=matrix', '2000'], { out: term(2000) }],
  ['CLI-A07', 'l’option peut suivre l’indice', ['2000', '--algo', 'matrix'], { out: term(2000) }],
  ['CLI-A08', 'répéter --algo est accepté', ['--algo', 'fast', '--algo', 'matrix', '2000'], { out: term(2000) }],
  ['CLI-A09', '--algo sans valeur est refusé', ['--algo'], 'erreur'],
  ['CLI-A10', '--algo= avec une valeur vide est refusé', ['--algo=', '5'], 'erreur'],
  ['CLI-A11', 'un algorithme inconnu est refusé', ['--algo', 'bogus', '5'], 'erreur'],
  ['CLI-A12', 'le nom de l’algorithme est sensible à la casse', ['--algo', 'FAST', '5'], 'erreur'],
  ['CLI-A13', '--algo 5 prend 5 pour valeur, et l’indice manque', ['--algo', '5'], 'erreur'],
  ['CLI-A14', 'le nom de l’option est sensible à la casse', ['--Algo', 'fast', '5'], 'erreur'],
  ['CLI-A15', '--algo --list 5 prend --list pour valeur', ['--algo', '--list', '5'], 'erreur'],
  ['CLI-A16', 'chaque occurrence de --algo doit être valide, même si une valide suit', ['--algo', 'bogus', '--algo', 'fast', '5'], 'erreur'],
  ['CLI-A17', '--algo avec une valeur vide (forme séparée) est refusé', ['--algo', '', '5'], 'erreur'],
  ['CLI-A18', 'un saut de ligne dans un argument ne produit pas deux lignes', ['--algo', 'x\ny', '5'], 'erreur'],
  ['CLI-A19', 'la casse compte à chaque occurrence de --algo, même si une valide suit', ['--algo', 'FAST', '--algo', 'fast', '5'], 'erreur'],
  ['CLI-A20', 'une valeur non ASCII de --algo : la ligne d’erreur reste en ASCII', ['--algo', 'fäst', '5'], 'erreur'],
];

// Partagé par CLI-L06 et CLI-L16 : la liste de 10 001 termes, quelle que soit l'écriture de l'indice.
const checkList10000 = (out: string) => {
  assert.ok(out.endsWith('\n'), 'la dernière ligne se termine par \\n');
  const rows = out.split('\n');
  rows.pop();
  assert.equal(rows.length, 10001);
  assert.deepEqual(rows.slice(0, 2001), terms());
  for (let i = 2; i < rows.length; i++) {
    // BigInt() accepte `007`, ` 12`, `12 `, `+5` et `0x10` : la forme décimale se vérifie avant la somme.
    assert.match(rows[i], /^(0|[1-9][0-9]*)$/, `ligne ${i}`);
    assert.equal(BigInt(rows[i]), BigInt(rows[i - 1]) + BigInt(rows[i - 2]), `ligne ${i}`);
  }
  assert.equal(rows[10000].length, 2090);
};

const L: Case[] = [
  ['CLI-L01', '--list 0 écrit seulement F(0)', ['--list', '0'], { out: list(0) }],
  ['CLI-L02', '--list 1 écrit F(0) et F(1)', ['--list', '1'], { out: list(1) }],
  ['CLI-L03', '--list 2 écrit trois lignes', ['--list', '2'], { out: list(2) }],
  ['CLI-L04', '--list 20 écrit les 21 premiers termes', ['--list', '20'], { out: list(20) }],
  ['CLI-L05', '--list 2000 écrit les 2 001 termes de l’oracle', ['--list', '2000'], { out: list(2000) }],
  ['CLI-L06', '--list 10000 écrit 10 001 lignes cohérentes avec l’oracle et la récurrence', ['--list', '10000'], { check: checkList10000 }],
  ['CLI-L07', 'le drapeau peut suivre l’indice', ['5', '--list'], { out: list(5) }],
  ['CLI-L08', 'répéter --list ne change rien', ['--list', '--list', '3'], { out: list(3) }],
  ['CLI-L09', '10001 dépasse la borne d’une liste', ['--list', '10001'], 'erreur'],
  ['CLI-L10', '--list et --algo s’excluent', ['--list', '--algo', 'fast', '5'], 'erreur'],
  ['CLI-L11', '--algo et --list s’excluent dans l’autre ordre', ['--algo', 'fast', '--list', '5'], 'erreur'],
  ['CLI-L12', '--list et --algo all s’excluent', ['--list', '--algo', 'all', '5'], 'erreur'],
  ['CLI-L13', '--list sans indice est refusé', ['--list'], 'erreur'],
  ['CLI-L14', '--list=5 est refusé : un drapeau ne prend pas de valeur', ['--list=5'], 'erreur'],
  ['CLI-L15', 'la borne d’une liste s’applique malgré les zéros de tête', ['--list', '00010001'], 'erreur'],
  ['CLI-L16', 'des zéros de tête sont permis pour une liste : 010000 vaut 10000', ['--list', '010000'], { check: checkList10000 }],
];

const D: Case[] = [
  ['CLI-D01', '--time écrit la durée de fast sur stderr', ['--time', '50'], { out: term(50), times: ['fast'] }],
  ['CLI-D02', '--time avec --algo all chronomètre fast, iterative puis matrix', ['--time', '--algo', 'all', '50'], { out: term(50), times: ['fast', 'iterative', 'matrix'] }],
  ['CLI-D03', '--time avec --algo matrix chronomètre matrix', ['--time', '--algo', 'matrix', '50'], { out: term(50), times: ['matrix'] }],
  ['CLI-D04', 'la dernière occurrence de --algo gagne', ['--time', '--algo', 'fast', '--algo', 'matrix', '50'], { out: term(50), times: ['matrix'] }],
  ['CLI-D05', 'la dernière occurrence de --algo gagne aussi sur all', ['--algo', 'all', '--algo', 'iterative', '--time', '50'], { out: term(50), times: ['iterative'] }],
  ['CLI-D06', '--time avec --list chronomètre iterative', ['--time', '--list', '5'], { out: list(5), times: ['iterative'] }],
  ['CLI-D07', '--time peut suivre l’indice', ['50', '--time'], { out: term(50), times: ['fast'] }],
  ['CLI-D08', 'répéter --time ne donne qu’une ligne', ['--time', '--time', '50'], { out: term(50), times: ['fast'] }],
  ['CLI-D09', '--time sans indice est refusé', ['--time'], 'erreur'],
  ['CLI-D10', '--time=1 est refusé : un drapeau ne prend pas de valeur', ['--time=1', '5'], 'erreur'],
  ['CLI-D11', 'un indice invalide ne laisse aucune ligne de durée', ['--time', 'abc'], 'erreur'],
];

const H: Case[] = [
  ['CLI-H01', '--help écrit l’usage sur stdout, code 0', ['--help'], { out: USAGE }],
  ['CLI-H02', '-h écrit l’usage', ['-h'], { out: USAGE }],
  ['CLI-H03', 'l’aide l’emporte sur une option inconnue', ['--help', '--bogus'], { out: USAGE }],
  ['CLI-H04', 'l’aide l’emporte où qu’elle soit', ['5', '-h'], { out: USAGE }],
  ['CLI-H05', 'l’aide l’emporte à la place de la valeur de --algo', ['--algo', '--help'], { out: USAGE }],
  ['CLI-H06', 'l’aide l’emporte sur une borne dépassée', ['--list', '10001', '--help'], { out: USAGE }],
  ['CLI-H07', 'répéter --help écrit l’usage une fois', ['--help', '--help'], { out: USAGE }],
  ['CLI-H08', '-help est une option inconnue', ['-help'], 'erreur'],
  ['CLI-H09', '--HELP est refusé : le nom de l’option est sensible à la casse', ['--HELP'], 'erreur'],
  ['CLI-H10', '--algo=--help n’est pas l’aide', ['--algo=--help', '5'], 'erreur'],
  ['CLI-H11', 'l’aide l’emporte sur un indice invalide', ['abc', '--help'], { out: USAGE }],
];

const U: Case[] = [
  ['CLI-U01', 'une option longue inconnue est refusée', ['--bogus', '5'], 'erreur'],
  ['CLI-U02', 'un tiret seul est une option inconnue', ['-', '5'], 'erreur'],
  ['CLI-U03', 'un double tiret est une option inconnue, pas une fin des options', ['--', '5'], 'erreur'],
  ['CLI-U04', 'option non ASCII : la ligne d’erreur reste en ASCII', ['--bogüs', '5'], 'erreur'],
  ['CLI-U05', 'plusieurs caractères non ASCII dans une option : la ligne d’erreur reste en ASCII', ['--bögüs', '5'], 'erreur'],
  ['CLI-U06', 'deux fautes ne produisent qu’une seule ligne fib:', ['--bogus', 'abc'], 'erreur'],
];

const V: Case[] = [
  ['CLI-V01', 'la locale ne change pas le point décimal des durées', ['--time', '50'], { out: term(50), times: ['fast'] },
    { LANG: 'fr_CA.UTF-8', LC_ALL: 'fr_CA.UTF-8', LC_NUMERIC: 'fr_CA.UTF-8' }],
  ['CLI-V03', 'PYTHONIOENCODING ne change pas les octets écrits', ['--time', '50'], { out: term(50), times: ['fast'] }, { PYTHONIOENCODING: 'utf-16' }],
];

// CLI-V02 joue trois exécutions (U01, H01 puis T01) : l'oracle ne sert qu'à la dernière, pour que l'ESC soit cherché partout.
const V02 = (impl: string) => {
  // NO_COLOR retiré (undefined : spawnSync l'omet), non vidé. Hérité du parent, il l'emporterait sur FORCE_COLOR sous Python 3.14 et viderait le cas de son sens.
  // Vidé, il ferait écrire à Node 22 un avertissement sur stderr dès qu'un console.* tourne avec FORCE_COLOR, et rougir X-3 pour une raison du harnais.
  const env = { FORCE_COLOR: '1', CLICOLOR_FORCE: '1', PYTHON_COLORS: '1', NO_COLOR: undefined };
  verify(run(impl, ['--bogus', '5'], env), 'erreur');
  verify(run(impl, ['--help'], env), { out: USAGE });
  verify(run(impl, ['10'], env), { out: term(10) });
};

const CASES: Case[] = [...T, ...I, ...A, ...L, ...D, ...H, ...U, ...V];

describe('oracle', () => {
  for (const [id, title, check] of CHECKS) test(`${id} : ${title}`, () => check(lines()));
});

const requested = process.argv.slice(2);
const ids = requested.length ? requested : Object.keys(IMPLS).filter((id) => existsSync(join(root, IMPLS[id].dir)));

for (const id of ids) {
  describe(id, () => {
    if (!Object.hasOwn(IMPLS, id) || !existsSync(join(root, IMPLS[id].dir))) {
      test(`${id} : l’implémentation existe`, () => assert.fail(`implémentation absente : ${id}`));
      return;
    }
    if (BUILDS[id]) {
      before(() => {
        const [cmd, ...args] = BUILDS[id];
        const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
        const out = `${r.stdout}${r.stderr}${r.error ?? ''}`;
        assert.equal(r.status, 0, `${BUILDS[id].join(' ')} a échoué (code ${r.status}) : ${out}`);
      });
    }
    for (const [cid, title, args, want, env] of CASES) test(`${cid} : ${title}`, () => verify(run(id, args, env), want));
    test('CLI-V02 : forcer la couleur ne produit aucun octet ESC', () => V02(id));
  });
}
