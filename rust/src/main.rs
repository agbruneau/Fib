//! Commande fib : adaptateur mince autour de la bibliothèque fib (contrat du PRD § 4, analyse manuelle selon l'ADR-0002).
use fib::{Algo, fib, fib_list};
use num_bigint::BigUint;
use std::{env, io::Write, process::ExitCode, time::Instant};

const USAGE: &str = "usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
";
const MAX_TERM: u64 = 100_000;
const MAX_LIST: u64 = 10_000;
const COMPARISON: [Algo; 3] = [Algo::Fast, Algo::Iterative, Algo::Matrix];

/// Code de sortie (2 : erreur d'usage, 3 : discordance) et message, sans le préfixe `fib: `.
struct CliError(u8, String);

fn usage_error(msg: impl Into<String>) -> CliError {
    CliError(2, msg.into())
}

struct Options {
    algos: Vec<Algo>,
    list: bool,
    time: bool,
    n: u64,
}

/// Applique la grammaire du PRD § 4.
fn parse(args: &[String]) -> Result<Options, CliError> {
    let mut algos: Option<Vec<Algo>> = None;
    let mut list = false;
    let mut time = false;
    let mut positional = Vec::new();
    let mut it = args.iter();
    while let Some(a) = it.next() {
        if a == "--algo" || a.starts_with("--algo=") {
            // --algo X : X est l'argument suivant, quel qu'il soit;
            // chaque occurrence doit être valide, la dernière gagne.
            let value = match a.strip_prefix("--algo=") {
                Some(v) => v,
                None => it.next().map(String::as_str).ok_or_else(|| usage_error("--algo demande une valeur"))?,
            };
            algos = Some(if value == "all" {
                COMPARISON.to_vec()
            } else {
                // L'argument fautif est cité, en ASCII.
                let algo = value
                    .parse()
                    .map_err(|_| usage_error(format!("algorithme inconnu : \"{}\"", value.escape_default())))?;
                vec![algo]
            });
        } else if a == "--list" {
            list = true;
        } else if a == "--time" {
            time = true;
        } else if a.starts_with('-') {
            return Err(usage_error(format!("option inconnue : \"{}\"", a.escape_default())));
        } else {
            positional.push(a);
        }
    }
    if list && algos.is_some() {
        return Err(usage_error("--list et --algo s'excluent"));
    }
    let [index] = positional[..] else { return Err(usage_error("exactement un indice attendu")) };
    // Chiffres ASCII seulement, avant toute conversion : `parse` accepte `+5`.
    if index.is_empty() || !index.bytes().all(|b| b.is_ascii_digit()) {
        return Err(usage_error("indice invalide : chiffres ASCII seulement"));
    }
    let n = index.parse().unwrap_or(u64::MAX); // un débordement de u64 dépasse toute borne
    let bound = if list { MAX_LIST } else { MAX_TERM };
    if n > bound {
        return Err(usage_error(format!("indice hors borne ({bound} au plus)")));
    }
    Ok(Options { algos: algos.unwrap_or(vec![Algo::Fast]), list, time, n })
}

/// Une ligne « <algo> <durée> ms » par calcul : le chronomètre ne couvre que le calcul, et le format ignore la locale.
fn timed<T>(name: &str, calc: impl FnOnce() -> T) -> (T, String) {
    let start = Instant::now();
    let result = calc();
    let ms = start.elapsed().as_secs_f64() * 1000.0;
    (result, format!("{name} {ms:.3} ms\n"))
}

/// Rend les termes à écrire et les lignes de durée; avec all, les trois algorithmes doivent concorder.
/// Rien n'est écrit ici : une discordance (F3) laisse stdout vide et sans durée.
fn compute(o: &Options) -> Result<(Vec<BigUint>, String), CliError> {
    if o.list {
        return Ok(timed("iterative", || fib_list(o.n)));
    }
    let (mut terms, durations): (Vec<_>, Vec<String>) =
        o.algos.iter().map(|&algo| timed(algo.name(), || fib(o.n, algo))).unzip();
    if terms.iter().any(|t| *t != terms[0]) {
        return Err(CliError(3, format!("discordance entre les algorithmes pour l'indice {}", o.n)));
    }
    terms.truncate(1); // ils concordent : un seul terme à écrire
    Ok((terms, durations.concat()))
}

/// Rend le texte de stdout et celui de stderr.
fn run(args: &[String]) -> Result<(String, String), CliError> {
    // L'aide l'emporte sur tout le reste, y compris à la place de la valeur de --algo.
    if args.iter().any(|a| a == "--help" || a == "-h") {
        return Ok((USAGE.into(), String::new()));
    }
    let options = parse(args)?;
    let (terms, durations) = compute(&options)?;
    let out = terms.iter().map(|t| format!("{t}\n")).collect();
    Ok((out, if options.time { durations } else { String::new() }))
}

fn main() -> ExitCode {
    // `args_os` plutôt que `args`, qui paniquerait sur un argument qui n'est pas de l'Unicode valide.
    let args: Vec<String> = env::args_os().skip(1).map(|a| a.to_string_lossy().into_owned()).collect();
    match run(&args) {
        Ok((out, err)) => {
            // write_all plutôt que print! : un stdout fermé (hors contrat) ne doit pas faire paniquer.
            let _ = std::io::stdout().write_all(out.as_bytes());
            let _ = std::io::stderr().write_all(err.as_bytes());
            ExitCode::SUCCESS
        }
        Err(CliError(code, msg)) => {
            let _ = writeln!(std::io::stderr(), "fib: {msg}");
            ExitCode::from(code)
        }
    }
}
