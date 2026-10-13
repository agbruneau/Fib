// Banc d'essai des CLI (ADR-0004) : médiane du temps total du processus et du calcul rapporté par --time.
// Usage : node contracts/bench.ts [go|rust|ts|py …] [--runs N] [--contre REF]. Compile puis lance par contracts/lancement.ts, comme le contrat.
// --contre REF : A/B apparié, la révision REF (A) contre l'arbre de travail (B), lancés en alternance (le travail d'un démarrage, ADR-0004).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
import { build, launch, present, ROOT } from './lancement.ts';

const SCENARIOS: [name: string, args: string[]][] = [
  ['petit (10)', ['10']],
  ['terme (100000, fast)', ['100000']],
  ['terme (1000000, fast)', ['1000000']],
  ['matrix 100000', ['--algo', 'matrix', '100000']],
  ['iterative 100000', ['--algo', 'iterative', '100000']],
  ['all 100000', ['--algo', 'all', '100000']],
  ['liste 10000', ['--list', '10000']],
];

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

// Une exécution avec --time : temps total du processus, et somme des durées qu'il rapporte. Exportée pour le harnais.
// root : la racine d'une révision extraite (A/B), par défaut ce dépôt.
export function measure(id: string, args: readonly string[], root?: string): { wall: number; calc: number } {
  // La commande de l'implémentation, puis --time et les arguments, sans enveloppeur ni stderrClosed (HAR-1).
  const r = launch(id, ['--time', ...args], { root });
  if (r.code !== 0) throw new Error(`${id} ${args.join(' ')} : code ${r.code}, ${r.err}`);
  const calc = r.err.split('\n').filter(Boolean).reduce((sum, line) => sum + Number(line.split(' ')[1]), 0);
  return { wall: r.ms, calc };
}

// Le tour i d'un A/B : A puis B aux tours pairs, B puis A aux impairs, pour qu'aucun des deux ne suive toujours l'autre
// (le second lancement profite des caches du premier). Rend toujours [A, B]. Exportée pour le harnais (HAR-5).
export function pair<T>(i: number, a: () => T, b: () => T): [a: T, b: T] {
  if (i % 2 === 0) {
    const x = a();
    return [x, b()];
  }
  const y = b();
  return [a(), y];
}

// Résume des paires [A, B] : les médianes de A et de B, la médiane des différences B − A (négative quand B est plus rapide), et le
// nombre de paires où B est strictement plus rapide. La médiane des différences, non la différence des médianes : la dérive de la
// machine touche A et B d'un même tour, et seule la différence par paire l'annule. Exportée pour le harnais (HAR-5).
export function paired(pairs: readonly (readonly [a: number, b: number])[]): { a: number; b: number; d: number; faster: number } {
  const d = pairs.map(([a, b]) => b - a);
  return { a: median(pairs.map(([a]) => a)), b: median(pairs.map(([, b]) => b)), d: median(d), faster: d.filter((x) => x < 0).length };
}

// Un tour d'A/B sur un scénario, en temps total : A depuis la racine de la révision, B depuis ce dépôt. Si A partait aussi de
// ce dépôt, l'A/B comparerait l'arbre de travail à lui-même. Exportée pour le harnais (HAR-5).
export const abRound = (i: number, id: string, args: readonly string[], root: string): [a: number, b: number] =>
  pair(i, () => measure(id, args, root).wall, () => measure(id, args).wall);

// Les seuls chemins du build (PRD § 5) : une révision extraite n'emporte ni CLAUDE.md ni .claude/, qu'une session lancée sous
// .build/ lirait comme des instructions. package.json y reste : son "type": "module" fait de .build/ts/cli.js un module ES.
const BUILD_PATHS = ['go/', 'rust/', 'ts/', 'python/', 'package.json', ':(glob)tsconfig*.json'];

// Extrait la révision ref sous .build/revisions/<sha> et rend sa racine. Une fois : si le dossier existe, il est réutilisé, avec
// ses binaires déjà construits. L'extraction passe par un index à part (GIT_INDEX_FILE) et un dossier provisoire renommé à la fin :
// ni l'index ni la liste des worktrees ne changent, et une extraction interrompue ne laisse pas un dossier à moitié rempli.
function extract(ref: string): string {
  const git = (args: string[], env: Record<string, string> = {}, input?: string) => {
    const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }, input });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} a échoué (code ${r.status}) : ${r.stderr}${r.error ?? ''}`);
    return r.stdout;
  };
  const resolved = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: ROOT, encoding: 'utf8' });
  if (resolved.status !== 0) throw new Error(`révision introuvable : ${ref}`);
  const sha = resolved.stdout.trim();
  const dest = join(ROOT, '.build', 'revisions', sha);
  if (existsSync(dest)) return dest;
  const part = `${dest}.part`;
  const index = `${dest}.index`;
  rmSync(part, { recursive: true, force: true });
  rmSync(index, { force: true });
  mkdirSync(part, { recursive: true });
  const env = { GIT_INDEX_FILE: index };
  git(['read-tree', sha], env);
  git(['checkout-index', '-z', '--stdin', `--prefix=${part}/`], env, git(['ls-files', '-z', '--', ...BUILD_PATHS], env));
  rmSync(index);
  // tsc et les @types y sont cherchés dans node_modules : la révision emprunte ceux de ce dépôt (jonction sous Windows).
  symlinkSync(join(ROOT, 'node_modules'), join(part, 'node_modules'), 'junction');
  renameSync(part, dest);
  return dest;
}

const USAGE = 'usage : node contracts/bench.ts [go|rust|ts|py …] [--runs N] [--contre REF]';

// Les identifiants demandés (aucun : les implémentations présentes), le nombre d'exécutions par scénario, et la révision REF d'un A/B
// (absente sans `--contre`, donc sans clé). Toute erreur levée ici est une erreur d'usage. `--runs` veut des chiffres décimaux
// seulement : Number() accepte aussi '', ' 3', '1e3' et '0x10', et rend NaN, 0 ou une boucle sans fin pour le reste, que cell()
// découvre trop tard. `--contre` veut une révision qui ne ressemble pas à une option, que git lirait comme telle.
export function parseArgs(args: readonly string[]): { runs: number; ids: string[]; ref?: string } {
  let runs = 11;
  let ref: string | undefined;
  const ids: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--contre') {
      const value = args[++i];
      if (value === undefined || value === '' || value.startsWith('-')) {
        throw new Error(`--contre demande une révision (reçu : ${value === undefined ? 'aucune valeur' : JSON.stringify(value)})`);
      }
      ref = value;
      continue;
    }
    if (args[i] !== '--runs') {
      ids.push(args[i]);
      continue;
    }
    const value = args[++i];
    const n = Number(value);
    if (value === undefined || !/^[0-9]+$/.test(value) || !Number.isSafeInteger(n) || n < 1) {
      throw new Error(`--runs demande un entier d’au moins 1 (reçu : ${value === undefined ? 'aucune valeur' : JSON.stringify(value)})`);
    }
    runs = n;
  }
  return ref === undefined ? { runs, ids } : { runs, ids, ref };
}

const cell = (x: number) => x.toFixed(1).padStart(8);

// Le banc ordinaire : médianes du temps total et du calcul, par langage et par scénario.
function table(ids: string[], runs: number): void {
  console.log(`médianes sur ${runs} exécutions (ms) : total du processus / calcul selon --time`);
  console.log(`${'scénario'.padEnd(22)}${ids.map((id) => `${id.padStart(10)} total   calcul`).join('')}`);
  const rows = SCENARIOS.map(([name]) => name.padEnd(22));
  for (const id of ids) {
    build(id);
    const samples = SCENARIOS.map((): { wall: number; calc: number }[] => []);
    // Le tour 0 réchauffe les caches; les scénarios s'entrelacent pour que la dérive de la machine les touche tous.
    for (let i = 0; i <= runs; i++) {
      SCENARIOS.forEach(([, args], s) => {
        const x = measure(id, args);
        if (i > 0) samples[s].push(x);
      });
    }
    samples.forEach((xs, s) => {
      rows[s] += `${cell(median(xs.map((x) => x.wall)))} ${cell(median(xs.map((x) => x.calc)))}   `;
    });
  }
  console.log(rows.join('\n'));
}

// L'A/B apparié : la révision ref, extraite sous rev, contre l'arbre de travail, en temps total. Il ne compare que des temps, jamais
// des sorties : ref n'est pas un attendu (ADR-0001). Comme le banc, il lève si une CLI sort avec un code non nul. Les deux côtés
// se construisent avec les commandes d'aujourd'hui, justes tant qu'elles n'ont pas changé entre ref et l'arbre de travail.
function versus(ids: string[], runs: number, ref: string, rev: string): void {
  console.log(`A/B apparié sur ${runs} paire${runs > 1 ? 's' : ''} (ms, temps total) : A = ${ref} (${basename(rev).slice(0, 7)}), B = l'arbre de travail; ordre alterné, tour 0 écarté`);
  for (const id of ids) {
    build(id);
    if (!present(rev).includes(id)) throw new Error(`${id} absente de ${ref}`);
    build(id, rev);
    const pairs = SCENARIOS.map((): [number, number][] => []);
    // Le tour 0 réchauffe les caches des deux côtés; les scénarios s'entrelacent pour que la dérive de la machine les touche tous.
    for (let i = 0; i <= runs; i++) {
      SCENARIOS.forEach(([, args], s) => {
        const x = abRound(i, id, args, rev);
        if (i > 0) pairs[s].push(x);
      });
    }
    console.log(`${id.padEnd(22)}${'A'.padStart(8)} ${'B'.padStart(8)} ${'B − A'.padStart(8)} ${'%'.padStart(7)}   B < A`);
    pairs.forEach((p, s) => {
      const e = paired(p);
      console.log(`${SCENARIOS[s][0].padEnd(22)}${cell(e.a)} ${cell(e.b)} ${cell(e.d)} ${((100 * e.d) / e.a).toFixed(1).padStart(7)}   ${e.faster}/${p.length}`);
    });
  }
}

function main(argv: readonly string[]): number {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    // Avant tout build : le code 2 des erreurs d'usage de la CLI, sur stderr, sans pile.
    console.error(`bench: ${(e as Error).message}\n${USAGE}`);
    return 2;
  }
  const { runs, ref } = parsed;
  const ids = parsed.ids.length ? parsed.ids : present();
  if (ref === undefined) {
    table(ids, runs);
    return 0;
  }
  // Avant tout build : une révision introuvable ou une extraction qui échoue n'est pas payée deux fois.
  let rev: string;
  try {
    rev = extract(ref);
  } catch (e) {
    console.error(`bench: ${(e as Error).message}`);
    return 1;
  }
  versus(ids, runs, ref, rev);
  return 0;
}

// Un Node sans import.meta.main (< 22.18, 23.x, 24.0 et 24.1) laisserait le banc sans effet, en code 0 : échouer, en nommant la version
// (le garde-fou de ts/src/cli.ts, PRD § 5). L'import par le test de contrat échoue de même : il demande le même Node.
if (import.meta.main === undefined) throw new Error('le banc demande Node ^22.18 ou >=24.2 (import.meta.main est absent)');
if (import.meta.main) process.exitCode = main(process.argv.slice(2));
