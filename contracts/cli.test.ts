// Test de contrat : vérifie l'oracle, puis joue les cas CLI de docs/cas-de-test.md sur chaque implémentation.
// Usage : node contracts/cli.test.ts [go|rust|ts|py …]
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import cp, { spawnSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { measure, parseArgs } from './bench.ts';
import { build, closeStderr, command, IDS, launch, present, type LaunchOptions } from './lancement.ts';
import { CHECKS, lines, terms } from './oracle.ts';

const USAGE = `usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
`;

// 'erreur' : code 2, stdout vide, une seule ligne `fib: …`. Sinon code 0 : `out` exact et/ou `check`, `times` = algos chronométrés.
type Want = 'erreur' | { out?: string | (() => string); check?: (out: string) => void; times?: string[] };
type Case = [id: string, title: string, args: string[], want: Want, env?: LaunchOptions['env']];

// term et list sont paresseux : un oracle absent ne fait échouer que les cas qui en tirent leur attendu (catalogue § 3).
const term = (k: number) => () => `${terms()[k]}\n`;
const list = (n: number) => () => terms().slice(0, n + 1).map((t) => `${t}\n`).join('');

type Run = ReturnType<typeof launch>;

const assertAscii = (r: Run) =>
  assert.ok(/^[\n\x20-\x7e]*$/.test(r.out + r.err), 'X-4 : sortie non ASCII, ou avec \\r ou ESC');

// Assertions communes X-1 à X-4.
function verify(r: Run, want: Want): void {
  const ctx = `code ${r.code}, stderr ${JSON.stringify(r.err.slice(0, 200))}`;
  if (want === 'erreur') {
    assert.equal(r.code, 2, `X-1 : ${ctx}`);
    assert.match(r.err, /^fib: [^\n]*\n$/, 'X-3 : une seule ligne « fib: … »');
    assert.equal(r.out, '', 'X-2 : stdout vide');
    return assertAscii(r);
  }
  assert.equal(r.code, 0, `X-1 : ${ctx}`);
  const got = r.err.split('\n');
  assert.equal(got.pop(), '', `X-3 : stderr se termine par \\n (${ctx})`);
  got.forEach((l) => assert.match(l, /^(fast|iterative|matrix) [0-9]+\.[0-9]{3} ms$/, 'X-3 : ligne de durée'));
  assert.deepEqual(got.map((l) => l.split(' ')[0]), want.times ?? [], 'X-3 : algorithmes chronométrés');
  assertAscii(r);
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
  verify(launch(impl, ['--bogus', '5'], { env }), 'erreur');
  verify(launch(impl, ['--help'], { env }), { out: USAGE });
  verify(launch(impl, ['10'], { env }), { out: term(10) });
};

// Sous Windows, ni Node ni le contrat ne savent lancer un processus sans stderr : la raison s'affiche à la place du test.
const noShell = process.platform === 'win32' && 'Windows : ni Node ni le contrat ne lancent un processus sans stderr';

// CLI-V04 joue trois exécutions, le fd 2 fermé : sans stderr, X-3 ne s'applique pas, et `verify` ne sert pas.
// L'oracle ne sert qu'aux deux dernières, après le code. X-4 n'a pas d'assertion à part : l'égalité exacte de stdout, dont
// les attendus sont en ASCII, le couvre, et stderr vide ne laisse rien à y chercher.
const V04 = (impl: string) => {
  const runs: [args: string[], code: number, out: () => string][] = [
    [['--bogus', '5'], 2, () => ''],
    [['--time', '50'], 0, term(50)],
    [['10'], 0, term(10)],
  ];
  for (const [args, code, out] of runs) {
    const r = launch(impl, args, { stderrClosed: true });
    // Si le fd 2 restait ouvert, la ligne `fib: …` ou la durée s'y lirait : stderr vide prouve que `launch` a fermé le fd 2 pour la CLI.
    assert.equal(r.err, '', `le fd 2 n'est pas fermé : fib ${args.join(' ')}, stderr ${JSON.stringify(r.err.slice(0, 200))}`);
    assert.equal(r.code, code, `X-1 : fib ${args.join(' ')}, code ${r.code}`);
    assert.equal(r.out, out(), `X-2 : fib ${args.join(' ')}`);
  }
};

const CASES: Case[] = [...T, ...I, ...A, ...L, ...D, ...H, ...U, ...V];

describe('oracle', () => {
  for (const [id, title, check] of CHECKS) test(`${id} : ${title}`, () => check(lines()));
});

// Les contrôles du harnais, joués une fois pour les quatre CLI : ils éprouvent le test de contrat lui-même et rougissent
// quand il ferait passer un cas à vide. La sonde du fd 2 lance un vrai processus; HAR-1 à HAR-3 n'en lancent aucun.
describe('harnais', () => {
  // Si `2>&-` cessait de fermer le fd 2, CLI-V04 passerait à vide. Une redirection vers un fd fermé échoue (code non nul).
  test('CLI-V04 : le harnais ferme le fd 2', { skip: noShell }, () => {
    const [shell, shellArgs] = closeStderr(['/bin/sh', '-c', 'echo x >&2; echo $?']);
    const probe = spawnSync(shell, shellArgs, { encoding: 'latin1' });
    assert.ifError(probe.error);
    assert.match(probe.stdout, /^[1-9][0-9]*\n$/, 'le harnais ne ferme pas le fd 2');
  });

  // HAR-1 à HAR-3 remplacent spawnSync par un espion qui note l'appel et rend une exécution factice : rien n'est lancé ni
  // construit, et ils valent sous Windows.
  type Call = { file: string; args: readonly string[]; options: { env?: NodeJS.ProcessEnv } };
  const spy = (f: () => unknown): Call[] => {
    const real = cp.spawnSync;
    const calls: Call[] = [];
    const fake = (file: string, args: readonly string[], options: Call['options']) => {
      calls.push({ file, args, options });
      return { pid: 0, output: [], stdout: '55\n', stderr: 'fast 0.010 ms\n', status: 0, signal: null };
    };
    Object.assign(cp, { spawnSync: fake });
    syncBuiltinESMExports();
    try {
      f();
    } finally {
      Object.assign(cp, { spawnSync: real });
      syncBuiltinESMExports();
    }
    return calls;
  };

  // HAR-1 : le banc lance exactement la commande de l'implémentation, suivie de --time et des arguments : une propriété, non une
  // liste noire de shells. Tout enveloppeur (sh, env, ksh -c, nice, time…) ajouterait son démarrage à chaque mesure sans changer
  // aucune sortie. `command(id)` vient du tableau de lancement, non de `launch` : un défaut de `launch` ne fausse pas l'attendu.
  // Le second contrôle ajoute les options (cwd, env, tampon, délai), identiques à celles d'un lancement du contrat.
  // Ensemble : present(), les implémentations que le contrat et le banc jouent par défaut (HAR-3 prend tous les identifiants).
  test('HAR-1 : le banc lance la commande de chaque CLI, suivie de --time et des arguments, sans enveloppeur', () => {
    for (const id of present()) {
      const bench = spy(() => measure(id, ['10']));
      assert.equal(bench.length, 1, `${id} : une mesure, un lancement`);
      assert.deepEqual([bench[0].file, ...bench[0].args], [...command(id), '--time', '10'], `${id} : le banc ne lance pas la commande de l'implémentation`);
      assert.deepEqual(bench, spy(() => launch(id, ['--time', '10'])), `${id} : le banc ne lance pas l'appel du contrat`);
    }
  });

  // HAR-2 : l'env d'un cas s'ajoute à celui du processus, et undefined retire la variable (NO_COLOR de CLI-V02). Les CLI
  // ignorent ces variables par contrat : sur a906e27, un env perdu, substitué ou écrasé laissait le contrat vert (403/403).
  // La seule variable que le contrôle écrit dans process.env est FIB_RETIREE : il la rend telle qu'il l'a trouvée, absente ou non.
  test('HAR-2 : l’env d’un cas s’ajoute à celui du processus, et undefined retire la variable', () => {
    const avant = process.env.FIB_RETIREE;
    process.env.FIB_RETIREE = 'r';
    try {
      const [{ options }] = spy(() => launch('py', ['10'], { env: { FIB_SONDE: 'x', FIB_RETIREE: undefined } }));
      assert.equal(options.env?.FIB_SONDE, 'x', 'l’env du cas ne parvient pas au fils');
      assert.equal(options.env?.FIB_RETIREE, undefined, 'une variable mise à undefined reste dans l’env du fils');
      for (const k of Object.keys(process.env)) if (k !== 'FIB_RETIREE') assert.equal(options.env?.[k], process.env[k], `${k} n’est pas hérité`);
    } finally {
      if (avant === undefined) delete process.env.FIB_RETIREE;
      else process.env.FIB_RETIREE = avant;
    }
  });

  // HAR-3 : les CLI passent les mêmes cas, donc le contrat ne voit pas laquelle il lance. Sur a906e27, un `run` qui lançait
  // toujours Python laissait 403/403 : chaque identifiant doit lancer sa propre commande.
  // Ensemble : IDS, tous les identifiants du PRD § 5, présents ou non : `launch` ne lit pas le disque et l'espion ne lance rien.
  test('HAR-3 : chaque identifiant lance sa propre commande', () => {
    const cmds = IDS.map((id) => spy(() => launch(id, ['10'])).map((c) => [c.file, ...c.args].join(' ')).join());
    assert.equal(new Set(cmds).size, IDS.length, `commandes confondues : ${cmds.join(' | ')}`);
  });

  // HAR-4 : --runs demande un entier d'au moins 1. Absent, nul ou non numérique, il donnait NaN ou 0 lancement, puis un TypeError
  // dans cell() : le banc refuse maintenant par une erreur d'usage (code 2, sur stderr), avant tout build. Le processus du banc
  // lancé ici ne construit ni ne lance aucune implémentation.
  test('HAR-4 : --runs demande un entier d’au moins 1', () => {
    for (const mauvais of [[], [''], ['0'], ['-1'], ['2.5'], ['1e3'], ['0x10'], [' 3'], ['abc'], ['go']]) {
      assert.throws(() => parseArgs(['py', '--runs', ...mauvais]), /--runs demande un entier/, `--runs ${JSON.stringify(mauvais)} accepté`);
    }
    assert.deepEqual(parseArgs([]), { runs: 11, ids: [] });
    assert.deepEqual(parseArgs(['py', '--runs', '3', 'go']), { runs: 3, ids: ['py', 'go'] });
    assert.deepEqual(parseArgs(['--runs', '1']), { runs: 1, ids: [] });
    const banc = fileURLToPath(new URL('./bench.ts', import.meta.url));
    const r = spawnSync(process.execPath, [banc, 'py', '--runs', '0'], { encoding: 'utf8' });
    assert.ifError(r.error);
    assert.equal(r.status, 2, `code ${r.status}, stderr ${r.stderr.slice(0, 200)}`);
    assert.equal(r.stdout, '', 'une erreur d’usage n’écrit rien sur stdout');
    assert.match(r.stderr, /^bench: --runs demande un entier d’au moins 1 \(reçu : "0"\)\nusage : /);
  });
});

const requested = process.argv.slice(2);
const here = present();
const ids = requested.length ? requested : here;

for (const id of ids) {
  describe(id, () => {
    if (!here.includes(id)) {
      test(`${id} : l’implémentation existe`, () => assert.fail(`implémentation absente : ${id}`));
      return;
    }
    before(() => build(id));
    for (const [cid, title, args, want, env] of CASES) test(`${cid} : ${title}`, () => verify(launch(id, args, { env }), want));
    test('CLI-V02 : forcer la couleur ne produit aucun octet ESC', () => V02(id));
    test('CLI-V04 : un stderr fermé ne change ni stdout ni le code', { skip: noShell }, () => V04(id));
  });
}
