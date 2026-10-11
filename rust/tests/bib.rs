//! Seam 1 : la bibliothèque. Les attendus viennent de l'oracle (contracts/b000045.txt) ou de faits mathématiques.
use fib::{Algo, fib, fib_list};
use num_bigint::BigUint;

/// F(0) … F(2000), lus à l'exécution. Un oracle absent ou invalide fait échouer le test;
/// il ne sert jamais d'attendu par défaut.
fn oracle() -> Vec<BigUint> {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../contracts/b000045.txt");
    let text = std::fs::read_to_string(path).expect("oracle illisible : contracts/b000045.txt");
    let terms: Vec<BigUint> = text
        .lines()
        .filter(|l| !l.is_empty())
        .enumerate()
        .map(|(i, l)| {
            let (n, term) = l.split_once(' ').expect("oracle invalide : ligne sans espace");
            assert_eq!(n, i.to_string(), "oracle invalide : indice hors séquence");
            term.parse().expect("oracle invalide : terme non décimal")
        })
        .collect();
    assert_eq!(terms.len(), 2001, "oracle invalide : 2 001 termes attendus");
    terms
}

/// fib(n, algo) égale l'oracle pour n = 0..2000.
fn sweep(algo: Algo) {
    for (n, want) in oracle().iter().enumerate() {
        assert_eq!(fib(n as u64, algo), *want, "n = {n}");
    }
}

#[test]
fn bib_01_fib_0_iterative_vaut_0() {
    assert_eq!(fib(0, Algo::Iterative), oracle()[0]);
}

#[test]
fn bib_02_fib_1_iterative_vaut_1() {
    assert_eq!(fib(1, Algo::Iterative), oracle()[1]);
}

#[test]
fn bib_03_fib_2_iterative_vaut_1() {
    assert_eq!(fib(2, Algo::Iterative), oracle()[2]);
}

#[test]
fn bib_04_fib_10_iterative_vaut_55() {
    assert_eq!(fib(10, Algo::Iterative), oracle()[10]);
}

#[test]
fn bib_05_iterative_egale_l_oracle_de_0_a_2000_au_dela_d_int64_et_d_uint64() {
    sweep(Algo::Iterative);
}

#[test]
fn bib_06_fast_egale_l_oracle_de_0_a_2000() {
    sweep(Algo::Fast);
}

#[test]
fn bib_07_matrix_egale_l_oracle_de_0_a_2000() {
    sweep(Algo::Matrix);
}

#[test]
fn bib_08_fib_100000_rend_le_meme_terme_de_20899_chiffres_pour_les_trois_algorithmes() {
    let [first, others @ ..] = Algo::ALL.map(|a| fib(100_000, a));
    assert!(others.iter().all(|t| *t == first));
    assert_eq!(first.to_string().len(), 20_899);
}

#[test]
fn bib_09_cassini_a_n_100000_pour_chaque_algorithme() {
    for algo in Algo::ALL {
        let [before, at, after] = [99_999, 100_000, 100_001].map(|n| fib(n, algo));
        // BigUint est non signé : on compare before·after à at² + 1 plutôt que de soustraire.
        assert_eq!(before * after, at.pow(2) + 1u8, "{algo:?}");
    }
}

#[test]
fn bib_10_fib_list_0_vaut_0() {
    assert_eq!(fib_list(0), oracle()[..1]);
}

#[test]
fn bib_11_fib_list_1_vaut_0_1() {
    assert_eq!(fib_list(1), oracle()[..2]);
}

#[test]
fn bib_12_fib_list_2000_rend_les_2001_termes_de_l_oracle_dans_l_ordre() {
    assert_eq!(fib_list(2000), oracle());
}

#[test]
fn bib_13_un_nom_d_algorithme_inconnu_est_refuse() {
    for name in ["all", "bogus", "", "FAST"] {
        assert!(name.parse::<Algo>().is_err(), "{name:?} devrait être refusé");
    }
}

// BIB-14 ne s'applique pas : l'indice est un u64 (docs/cas-de-test.md § 4).
