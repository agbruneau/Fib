//! Commande fib : adaptateur mince autour de la bibliothèque fib (PRD § 4, analyse manuelle selon l'ADR-0002).
use fib::{Algo, fib, fib_list};
use num_bigint::BigUint;
use std::{
    env,
    io::{BufWriter, Write},
    process::ExitCode,
    time::Instant,
};

const USAGE: &str = "usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
";
const MAX_TERM: u64 = 1_000_000;
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

/// Rend les lignes de stdout (un terme par ligne) et les lignes de durée; avec all, les trois algorithmes doivent
/// concorder. Rien n'est écrit ici : une discordance (F3) laisse stdout vide et sans durée.
/// `term` est générique, non un `fn` ou un `dyn` : l'appel reste direct, et un test y passe un terme faussé.
fn compute(o: &Options, term: impl Fn(u64, Algo) -> BigUint) -> Result<(Vec<String>, String), CliError> {
    if o.list {
        return Ok(timed("iterative", || fib_list(o.n)));
    }
    let (terms, durations): (Vec<_>, Vec<String>) =
        o.algos.iter().map(|&algo| timed(algo.name(), || term(o.n, algo))).unzip();
    if terms.iter().any(|t| *t != terms[0]) {
        return Err(CliError(3, format!("discordance entre les algorithmes pour l'indice {}", o.n)));
    }
    Ok((vec![terms[0].to_string()], durations.concat()))
}

/// Rend les lignes de stdout et le texte de stderr; `term` calcule un terme (`fib` pour `main`).
fn run(args: &[String], term: impl Fn(u64, Algo) -> BigUint) -> Result<(Vec<String>, String), CliError> {
    // L'aide l'emporte sur tout le reste, y compris à la place de la valeur de --algo.
    if args.iter().any(|a| a == "--help" || a == "-h") {
        // La sortie ajoute '\n' à chaque ligne : sans trim_end, l'aide finirait par une ligne vide.
        return Ok((vec![USAGE.trim_end().into()], String::new()));
    }
    let options = parse(args)?;
    let (lines, durations) = compute(&options, term)?;
    Ok((lines, if options.time { durations } else { String::new() }))
}

/// Tampon de stdout : les ~10 Mo de `--list 10000` passent par des écritures de 64 Kio qui réutilisent la même
/// mémoire, plutôt que par un seul texte de 10 Mo (défauts de page et copie : mesuré 12 % plus lent).
const STDOUT_BUFFER: usize = 1 << 16;

/// Écrit chaque ligne suivie de `\n` par le tampon, puis le vide. `write_all` plutôt que `print!`, et les erreurs sont
/// ignorées : un stdout fermé (hors contrat) ne doit pas faire paniquer.
fn write_lines<W: Write>(w: W, lines: &[String]) {
    let mut out = BufWriter::with_capacity(STDOUT_BUFFER, w);
    for line in lines {
        let _ = out.write_all(line.as_bytes());
        let _ = out.write_all(b"\n");
    }
    let _ = out.flush();
}

fn main() -> ExitCode {
    // `args_os` plutôt que `args`, qui paniquerait sur un argument qui n'est pas de l'Unicode valide.
    let args: Vec<String> = env::args_os().skip(1).map(|a| a.to_string_lossy().into_owned()).collect();
    match run(&args, fib) {
        Ok((lines, err)) => {
            write_lines(std::io::stdout().lock(), &lines);
            let _ = std::io::stderr().write_all(err.as_bytes());
            std::mem::forget(lines); // le processus se termine : libérer 10 001 chaînes coûterait ~2 ms pour rien
            ExitCode::SUCCESS
        }
        Err(CliError(code, msg)) => {
            let _ = writeln!(std::io::stderr(), "fib: {msg}");
            ExitCode::from(code)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    /// Un `Write` qui garde les octets reçus et compte ses appels à `write`.
    #[derive(Default)]
    struct Spy {
        bytes: Vec<u8>,
        writes: usize,
    }

    impl Write for Spy {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.writes += 1;
            self.bytes.extend_from_slice(buf);
            Ok(buf.len())
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    // PERF-RS-8, hors catalogue : garde de l'optimisation « écriture tamponnée de stdout » (ADR-0004). Elle compte les
    // appels à `write` au lieu de chronométrer : un chronomètre serait instable, ce compte est exact. Observé : 162
    // appels avec le tampon de 64 Kio, 1 394 avec `BufWriter::new` (8 Kio), 20 002 sans tampon. La borne ne dérive pas
    // de `STDOUT_BUFFER`, la constante que la garde protège : avec `1 << 4` (16 octets), une borne tirée de la
    // constante grimpe à 1,3 million d'appels et laisse passer le mutant. `MIN_BLOCK` est absolue, la moitié du tampon
    // mesuré (comme `minBlock` de PERF-GO-6) : 320 appels au plus, soit un facteur 2 de marge sur les 162 observés.
    #[test]
    fn perf_rs_8_la_liste_maximale_s_ecrit_par_blocs_du_tampon_sans_perdre_un_octet() {
        const MIN_BLOCK: usize = 32 << 10;
        let lines = fib_list(MAX_LIST);
        let total: usize = lines.iter().map(|l| l.len() + 1).sum();
        let mut spy = Spy::default();
        write_lines(&mut spy, &lines);
        let at_most = total.div_ceil(MIN_BLOCK);
        assert!(spy.writes <= at_most, "{} appels à write, attendu {at_most} au plus", spy.writes);
        assert!(
            spy.bytes == format!("{}\n", lines.join("\n")).as_bytes(),
            "octets écrits différents des lignes jointes"
        );
    }

    fn args(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| s.to_string()).collect()
    }

    // PERF-RS-11 (F3), hors catalogue : garde du code 3, que le contrat ne sait pas provoquer (catalogue § 6). `run`
    // reçoit un terme discordant : le vrai plus 1 pour un algorithme, tour à tour à chacune des trois places. Le test
    // ne recalcule aucun terme. Le type du résultat écarte les lignes de durée (`Err` ne porte que le code et le
    // message), mais pas une durée glissée dans le message : d'où l'absence de `\n` et de ` ms`. Rouge sous
    // `skip(3)`, `any(|_t| false)`, `take(2)`, `CliError(2, …)`, des durées ajoutées au message (une par ligne, ou sur
    // sa ligne) et `fib::fib` en dur dans `compute`; la forme naïve `*t != *t` échoue à clippy (`eq_op`).
    // Survivants connus, laissés à la revue : R7, un `eprint!` des durées avant l'erreur (stderr n'est pas dans le
    // résultat); R8b, `ExitCode::from(code.min(2))` dans `main`; RW, `main` passe une closure qui fait tout par `fast`.
    #[test]
    fn perf_rs_11_si_un_algorithme_diverge_des_deux_autres_run_rend_3_sans_duree() {
        for bad in [Algo::Fast, Algo::Iterative, Algo::Matrix] {
            let name = bad.name();
            let result =
                run(&args(&["--time", "--algo", "all", "10"]), |n, algo| fib(n, algo) + u32::from(algo == bad));
            let Err(CliError(code, msg)) = result else { panic!("{name} diverge : run devait échouer") };
            assert_eq!(code, 3, "{name} diverge");
            assert!(!msg.is_empty(), "{name} diverge : message vide");
            assert!(!msg.contains('\n'), "{name} diverge : plusieurs lignes dans le message {msg:?}");
            assert!(!msg.contains(" ms"), "{name} diverge : une durée (F6) dans le message {msg:?}");
        }
    }

    // PERF-RS-12 (F2 et F6), hors catalogue : l'algorithme nommé par une ligne de durée est celui qui calcule, un appel
    // chacun et dans l'ordre. Le contrat ne voit que le nom et le format de la ligne (catalogue § 6). Un espion note
    // l'algorithme puis délègue à `fib`; mêmes quatre cas que PERF-GO-10. Rouge sous le mutant où un seul algorithme
    // (`--algo iterative` ou `--algo matrix`) est calculé par `fast`, que PERF-RS-11 laisse passer.
    #[test]
    fn perf_rs_12_chaque_ligne_de_duree_nomme_l_algorithme_calcule() {
        let cases: [(&[&str], &[Algo]); 4] = [
            (&["10"], &[Algo::Fast]),
            (&["--algo", "iterative", "10"], &[Algo::Iterative]),
            (&["--algo", "matrix", "10"], &[Algo::Matrix]),
            (&["--algo", "all", "10"], &[Algo::Fast, Algo::Iterative, Algo::Matrix]),
        ];
        for (rest, expected) in cases {
            let calls = RefCell::new(Vec::new());
            let argv = args(&[&["--time"], rest].concat());
            let Ok((_, durations)) = run(&argv, |n, algo| {
                calls.borrow_mut().push(algo);
                fib(n, algo)
            }) else {
                panic!("--time {} : run devait réussir", rest.join(" "))
            };
            let calls = calls.into_inner();
            assert_eq!(calls, expected, "algorithmes calculés pour --time {}", rest.join(" "));
            let named: Vec<&str> = durations.lines().map(|l| l.split(' ').next().unwrap_or("")).collect();
            let called: Vec<&str> = calls.iter().map(|a| a.name()).collect();
            assert_eq!(named, called, "lignes de durée pour --time {}", rest.join(" "));
        }
    }
}
