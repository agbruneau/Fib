use fib::{Algo, fib, fib_list};
use std::{env, io::Write, process::ExitCode, time::Instant};

const USAGE: &str = "usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
";
const MAX_TERM: u64 = 100_000;
const MAX_LIST: u64 = 10_000;

/// Code de sortie (2 : erreur d'usage, 3 : discordance) et message, sans le préfixe `fib: `.
/// Les messages citent l'argument fautif par `escape_default`, qui reste en ASCII.
struct CliError(u8, String);

fn usage(msg: impl Into<String>) -> CliError {
    CliError(2, msg.into())
}

struct Options {
    algos: Vec<Algo>,
    list: bool,
    time: bool,
    n: u64,
}

fn parse(args: &[String]) -> Result<Options, CliError> {
    let (mut algos, mut list, mut time, mut indices) = (None, false, false, Vec::new());
    let mut it = args.iter();
    while let Some(a) = it.next() {
        if a == "--algo" || a.starts_with("--algo=") {
            let value = if a == "--algo" { it.next().map(String::as_str) } else { a.strip_prefix("--algo=") };
            let value = value.ok_or_else(|| usage("--algo demande une valeur"))?;
            let unknown = |_| usage(format!("algorithme inconnu : {}", value.escape_default()));
            algos = Some(if value == "all" { Algo::ALL.to_vec() } else { vec![value.parse().map_err(unknown)?] });
        } else if a == "--list" {
            list = true;
        } else if a == "--time" {
            time = true;
        } else if a.starts_with('-') {
            return Err(usage(format!("option inconnue : {}", a.escape_default())));
        } else {
            indices.push(a);
        }
    }
    if list && algos.is_some() {
        return Err(usage("--list et --algo s'excluent"));
    }
    let [index] = indices[..] else { return Err(usage("un seul indice attendu")) };
    // Chiffres ASCII seulement, avant toute conversion : `parse` accepte `+5`.
    if index.is_empty() || !index.bytes().all(|b| b.is_ascii_digit()) {
        return Err(usage("indice invalide : chiffres ASCII seulement"));
    }
    let n = index.parse().unwrap_or(u64::MAX); // un débordement de u64 dépasse toute borne
    let max = if list { MAX_LIST } else { MAX_TERM };
    if n > max {
        return Err(usage(format!("indice hors borne ({max} au plus)")));
    }
    Ok(Options { algos: algos.unwrap_or(vec![Algo::Fast]), list, time, n })
}

// Une ligne « <algo> <durée> ms » par calcul exécuté : le chronomètre ne couvre que le calcul.
fn timed<T>(name: &str, times: &mut String, calc: impl FnOnce() -> T) -> T {
    let start = Instant::now();
    let result = calc();
    let ms = start.elapsed().as_secs_f64() * 1000.0;
    times.push_str(&format!("{name} {ms:.3} ms\n"));
    result
}

/// Rend le texte de stdout et celui de stderr.
fn run(args: &[String]) -> Result<(String, String), CliError> {
    // L'aide l'emporte sur tout le reste, y compris à la place de la valeur de --algo.
    if args.iter().any(|a| a == "--help" || a == "-h") {
        return Ok((USAGE.into(), String::new()));
    }
    let Options { algos, list, time, n } = parse(args)?;
    let mut times = String::new();
    let terms = if list {
        timed("iterative", &mut times, || fib_list(n))
    } else {
        let mut terms: Vec<_> = algos.iter().map(|&a| timed(a.name(), &mut times, || fib(n, a))).collect();
        if terms.iter().any(|t| *t != terms[0]) {
            return Err(CliError(3, format!("discordance entre les algorithmes (indice {n})")));
        }
        terms.truncate(1); // ils concordent : un seul terme à écrire
        terms
    };
    Ok((terms.iter().map(|t| format!("{t}\n")).collect(), if time { times } else { String::new() }))
}

fn main() -> ExitCode {
    // `args_os` plutôt que `args`, qui paniquerait sur un argument qui n'est pas de l'Unicode valide.
    let args: Vec<String> = env::args_os().skip(1).map(|a| a.to_string_lossy().into_owned()).collect();
    match run(&args) {
        Ok((out, err)) => {
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
