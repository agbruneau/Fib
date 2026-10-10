import { fib, fibList, type Algo } from './fib.ts';

// Code 2 : erreur d'usage. Code 3 : discordance entre algorithmes.
class CliError extends Error {
  code: number;
  constructor(message: string, code = 2) {
    super(message);
    this.code = code;
  }
}

const USAGE = `usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
`;

const ALGOS = ['iterative', 'matrix', 'fast', 'all'];
const MAX_TERM = 100_000;
const MAX_LIST = 10_000;

// Les messages restent en ASCII : l'argument fautif est assaini avant d'être cité.
const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, '?');

function parse(args: string[]) {
  let algo: string | undefined;
  let list = false;
  let time = false;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--algo' || a.startsWith('--algo=')) {
      const value = a === '--algo' ? args[++i] : a.slice('--algo='.length);
      if (!ALGOS.includes(value)) {
        throw new CliError(value === undefined ? '--algo demande une valeur' : `algorithme inconnu : ${ascii(value)}`);
      }
      algo = value;
    } else if (a === '--list') {
      list = true;
    } else if (a === '--time') {
      time = true;
    } else if (a.startsWith('-')) {
      throw new CliError(`option inconnue : ${ascii(a)}`);
    } else {
      positional.push(a);
    }
  }
  if (list && algo !== undefined) throw new CliError("--list et --algo s'excluent");
  if (positional.length !== 1) throw new CliError(positional.length ? 'un seul indice attendu' : 'indice manquant');
  if (!/^[0-9]+$/.test(positional[0])) throw new CliError('indice invalide : chiffres ASCII seulement');
  const n = Number(positional[0]);
  const max = list ? MAX_LIST : MAX_TERM;
  if (n > max) throw new CliError(`indice hors borne (${max} au plus)`);
  return { algo: algo ?? 'fast', list, time, n };
}

// Une ligne « <algo> <durée> ms » par calcul exécuté : le chronomètre ne couvre que le calcul.
const durations: string[] = [];
function timed<T>(name: string, calc: () => T): T {
  const start = performance.now();
  const result = calc();
  durations.push(`${name} ${(performance.now() - start).toFixed(3)} ms\n`);
  return result;
}

// Les termes à écrire : la liste, un terme, ou, pour `all`, un terme sur lequel fast, iterative puis matrix concordent.
function compute({ algo, list, n }: ReturnType<typeof parse>): bigint[] {
  if (list) return timed('iterative', () => fibList(n));
  if (algo !== 'all') return [timed(algo, () => fib(n, algo as Algo))];
  const [first, ...others] = (['fast', 'iterative', 'matrix'] as const).map((a) => timed(a, () => fib(n, a)));
  if (others.some((t) => t !== first)) throw new CliError(`discordance entre les algorithmes pour l'indice ${n}`, 3);
  return [first];
}

function main(args: string[]): void {
  // L'aide l'emporte sur tout le reste, y compris à la place de la valeur de --algo.
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }
  try {
    const options = parse(args);
    const terms = compute(options);
    process.stdout.write(terms.map((t) => `${t}\n`).join(''));
    if (options.time) process.stderr.write(durations.join(''));
  } catch (e) {
    if (!(e instanceof CliError)) throw e;
    process.stderr.write(`fib: ${e.message}\n`);
    process.exitCode = e.code;
  }
}

main(process.argv.slice(2));
