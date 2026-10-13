// CLI de Fib : analyse les arguments, calcule par la bibliothèque, écrit les termes sur stdout, les durées sur stderr.
// run(args, io) la joue dans le processus : les tests de garde (cli.test.ts) y substituent fib, l'horloge et les flux.
import { fib, fibList, type Algo } from './fib.ts';

// Ce que run() consomme. Un Io passé est complet; sans lui, run prend celui du processus.
export type Io = {
  readonly fib: (n: number, algo: Algo) => bigint;
  readonly clock: () => number;
  readonly stdout: { write(text: string, encoding: 'latin1'): unknown };
  readonly stderr: { write(text: string): unknown };
};

const USAGE = `usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
`;

const MAX_TERM = 1_000_000;
const MAX_LIST = 10_000;

const COMPARISON: readonly Algo[] = ['fast', 'iterative', 'matrix'];

// Code 2 : erreur d'usage. Code 3 : discordance entre algorithmes.
class CliError extends Error {
  readonly code: number;
  constructor(message: string, code = 2) {
    super(message);
    this.code = code;
  }
}

// L'argument fautif est cité, en ASCII.
const ascii = (s: string) => s.replace(/[^\x20-\x7e]/gu, '?');

type Options = { algos: Algo[]; list: boolean; time: boolean; n: number };

// Applique la grammaire du PRD § 4.
function parse(args: readonly string[]): Options {
  let algos: Algo[] = [];
  let list = false;
  let time = false;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--algo' || arg.startsWith('--algo=')) {
      // --algo X : X est l'argument suivant, quel qu'il soit; chaque occurrence doit être valide, la dernière gagne.
      const value: string | undefined = arg === '--algo' ? args[++i] : arg.slice('--algo='.length);
      if (value === undefined) throw new CliError('--algo demande une valeur');
      if (value === 'all') {
        algos = [...COMPARISON];
      } else {
        const algo = COMPARISON.find((a) => a === value);
        if (algo === undefined) throw new CliError(`algorithme inconnu : "${ascii(value)}"`);
        algos = [algo];
      }
    } else if (arg === '--list') {
      list = true;
    } else if (arg === '--time') {
      time = true;
    } else if (arg.startsWith('-')) {
      throw new CliError(`option inconnue : "${ascii(arg)}"`);
    } else {
      positional.push(arg);
    }
  }
  if (list && algos.length > 0) throw new CliError("--list et --algo s'excluent");
  if (positional.length !== 1) throw new CliError('exactement un indice attendu');
  // Avant Number(), qui accepte « +5 », « 0x10 » et rend 0 pour « »; un indice géant donne Infinity, donc hors borne.
  if (!/^[0-9]+$/.test(positional[0])) throw new CliError('indice invalide : chiffres ASCII seulement');
  const n = Number(positional[0]);
  const bound = list ? MAX_LIST : MAX_TERM;
  if (n > bound) throw new CliError(`indice hors borne (${bound} au plus)`);
  return { algos: algos.length > 0 ? algos : ['fast'], list, time, n };
}

// Une ligne « <algo> <durée> ms » par calcul : le chronomètre ne couvre que le calcul, et le format ignore la locale.
function timed<T>(durations: string[], clock: Io['clock'], name: Algo, calc: () => T): T {
  const start = clock();
  const result = calc();
  durations.push(`${name} ${(clock() - start).toFixed(3)} ms\n`);
  return result;
}

// Rend les lignes à écrire et les lignes de durée; avec all, les trois algorithmes doivent concorder.
// Rien n'est écrit ici : une discordance (F3) laisse stdout vide et sans durée.
function compute({ algos, list, n }: Options, io: Pick<Io, 'fib' | 'clock'>): { lines: string[]; durations: string[] } {
  const durations: string[] = [];
  // fibList rend déjà le texte décimal : la durée mesurée le comprend.
  if (list) return { lines: timed(durations, io.clock, 'iterative', () => fibList(n)), durations };
  const terms = algos.map((algo) => timed(durations, io.clock, algo, () => io.fib(n, algo)));
  if (terms.some((term) => term !== terms[0])) {
    throw new CliError(`discordance entre les algorithmes pour l'indice ${n}`, 3);
  }
  return { lines: [String(terms[0])], durations };
}

// L'Io du processus. Accesseurs paresseux : le chemin d'erreur n'ouvre pas process.stdout (0,25 ms mesuré à l'étape 10; 0,09 ms sous Linux).
const processIo: Io = {
  fib,
  clock: () => performance.now(),
  get stdout() {
    return process.stdout;
  },
  get stderr() {
    return process.stderr;
  },
};

// Joue la CLI pour ces arguments et rend son code (0, 2 ou 3). Elle n'écrit que par io : jamais de process.argv ni de process.exitCode.
// Chaque flux reçoit au plus un appel, et rien n'est écrit avant la fin du calcul et de la comparaison.
export function run(args: readonly string[], io: Io = processIo): number {
  // L'aide l'emporte sur tout le reste, y compris à la place de la valeur de --algo.
  if (args.includes('--help') || args.includes('-h')) {
    io.stdout.write(USAGE, 'latin1');
    return 0;
  }
  try {
    const options = parse(args);
    const { lines, durations } = compute(options, io);
    // Un seul appel (PERF-TS-6); la copie ajoute la ligne vide du \n final (join puis + '\n' : 5 ms de plus pour 10 Mo, mesuré).
    // latin1 : la sortie est ASCII, et ce codage s'écrit un peu plus vite que l'UTF-8 (environ 2 % du temps total).
    io.stdout.write([...lines, ''].join('\n'), 'latin1');
    if (options.time) io.stderr.write(durations.join(''));
    return 0;
  } catch (e) {
    // Toute autre erreur est une défaillance : Node l'écrit avec sa pile et sort avec le code 1.
    if (!(e instanceof CliError)) throw e;
    io.stderr.write(`fib: ${e.message}\n`);
    return e.code;
  }
}

// Point d'entrée seulement : importer ce module (un test) ne lance rien. Jamais process.exit(), qui tronquerait un tube.
if (import.meta.main) process.exitCode = run(process.argv.slice(2));
