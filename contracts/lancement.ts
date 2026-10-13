// Lancement d'une implémentation : le seul lieu des commandes de build et de lancement (PRD § 5). Le test de contrat et
// le banc d'essai l'appellent tous deux : le banc mesure ainsi ce que le contrat vérifie.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const exe = process.platform === 'win32' ? '.exe' : '';

// Lancement depuis la racine. Go, Rust et TS passent par un build fait une fois, pour mesurer le programme et non son
// démarrage. Python : `-I -S` saute `site` et PYTHON*, sans changer la sortie de la CLI. tsc 7 est lancé par le point
// d'entrée JS du paquet : `.bin/tsc` n'est pas exécutable sans shell sous Windows.
const IMPLS: Record<string, { dir: string; build?: string[]; cmd: string[] }> = {
  go: { dir: 'go', build: ['go', '-C', 'go', 'build', '-o', `../.build/fib${exe}`, './cmd/fib'], cmd: [join(root, '.build', `fib${exe}`)] },
  rust: {
    dir: 'rust',
    build: ['cargo', 'build', '-q', '--release', '--manifest-path', 'rust/Cargo.toml'],
    cmd: [join(root, 'rust', 'target', 'release', `fib${exe}`)],
  },
  ts: {
    dir: 'ts',
    build: [process.execPath, 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'],
    cmd: [process.execPath, '.build/ts/cli.js'],
  },
  py: { dir: 'python', cmd: ['python', '-I', '-S', 'python/fib.py'] },
};

function impl(id: string) {
  if (!Object.hasOwn(IMPLS, id)) throw new Error(`implémentation inconnue : ${id}`);
  return IMPLS[id];
}

// Tous les identifiants du PRD § 5, dans cet ordre, que le dossier existe ou non : l'ensemble de HAR-3, qui n'a pas besoin du disque.
export const IDS: readonly string[] = Object.keys(IMPLS);

// Les identifiants des implémentations dont le dossier existe, dans l'ordre du PRD § 5 : ce que le contrat et le banc jouent par défaut.
export const present = (): string[] => IDS.filter((id) => existsSync(join(root, IMPLS[id].dir)));

// La commande de lancement de l'implémentation, sans argument : l'exécutable puis ses arguments fixes. HAR-1 y compare l'appel du banc.
export const command = (id: string): string[] => [...impl(id).cmd];

// Compile Go, Rust ou TypeScript; rien pour Python. Un échec lève une erreur qui porte la sortie du compilateur.
export function build(id: string): void {
  const cmd = impl(id).build;
  if (!cmd) return;
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd.join(' ')} a échoué (code ${r.status}) : ${r.stdout}${r.stderr}${r.error ?? ''}`);
}

// POSIX : `sh` ferme le descripteur 2, puis exécute la commande avec ses arguments inchangés ($0 la commande, $@ le reste).
// spawnSync ne sait pas fermer un fd : stdio 'ignore' ouvre /dev/null, ce qui n'est pas la même chose (vérifié).
export const closeStderr = (argv: readonly string[]): [string, string[]] => ['/bin/sh', ['-c', 'exec "$0" "$@" 2>&-', ...argv]];

export type LaunchOptions = {
  // S'ajoute à l'environnement du processus; une valeur undefined retire la variable (spawnSync l'omet).
  env?: Record<string, string | undefined>;
  // Lance la CLI le fd 2 fermé (CLI-V04), par /bin/sh : POSIX seulement.
  stderrClosed?: boolean;
};

// Lance la CLI construite et rend son code, ses deux flux en latin1 (un octet égale un caractère, donc X-2, X-4 et les
// longueurs voient les octets bruts) et la durée du seul spawnSync, que le banc rapporte.
export function launch(id: string, args: readonly string[], { env, stderrClosed = false }: LaunchOptions = {}) {
  const argv = [...command(id), ...args];
  // Sans stderrClosed, la CLI elle-même : le banc ne paie jamais le démarrage de /bin/sh.
  const [file, rest] = stderrClosed ? closeStderr(argv) : [argv[0], argv.slice(1)];
  const options = {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'latin1',
    // `--list 10000` écrit environ 10,5 Mo, au-delà du défaut.
    maxBuffer: 1 << 28,
    // Filet contre une CLI qui boucle (PRD § 6).
    timeout: 300_000,
  } as const;
  // Les options sont prêtes avant le chronomètre : il n'entoure que spawnSync, comme le banc l'a toujours fait.
  const start = process.hrtime.bigint();
  const r = spawnSync(file, rest, options);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  if (r.error) throw new Error(`${id} ${args.join(' ')} : ${r.error.message}`, { cause: r.error });
  return { code: r.status, out: r.stdout, err: r.stderr, ms };
}
