//! Calcul exact des termes de la suite de Fibonacci.
use num_bigint::BigUint;
use std::str::FromStr;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Algo {
    Iterative,
    Matrix,
    Fast,
}

impl Algo {
    /// Les trois algorithmes.
    pub const ALL: [Algo; 3] = [Algo::Iterative, Algo::Matrix, Algo::Fast];

    pub fn name(self) -> &'static str {
        match self {
            Algo::Iterative => "iterative",
            Algo::Matrix => "matrix",
            Algo::Fast => "fast",
        }
    }
}

#[derive(Debug)]
pub struct UnknownAlgo;

/// Le nom doit être exactement `iterative`, `matrix` ou `fast`, casse comprise.
impl FromStr for Algo {
    type Err = UnknownAlgo;

    fn from_str(s: &str) -> Result<Self, UnknownAlgo> {
        Algo::ALL.into_iter().find(|a| a.name() == s).ok_or(UnknownAlgo)
    }
}

/// Rend F(n) par l'algorithme algo.
/// L'enum et le u64 excluent un algorithme inconnu et n < 0 : le refus d'un nom se fait dans FromStr.
pub fn fib(n: u64, algo: Algo) -> BigUint {
    match algo {
        Algo::Iterative => iterative(n),
        Algo::Matrix => matrix(n),
        Algo::Fast => fast(n),
    }
}

/// F(0) … F(n), toujours par l'algorithme iterative.
pub fn fib_list(n: u64) -> Vec<BigUint> {
    let (mut a, mut b) = (BigUint::from(0u8), BigUint::from(1u8));
    let mut terms = vec![a.clone()];
    for _ in 0..n {
        (a, b) = (b.clone(), a + &b);
        terms.push(a.clone());
    }
    terms
}

/// Applique la définition indice par indice, avec deux termes consécutifs en mémoire.
fn iterative(n: u64) -> BigUint {
    let (mut a, mut b) = (BigUint::from(0u8), BigUint::from(1u8));
    for _ in 0..n {
        (a, b) = (b.clone(), a + &b);
    }
    a
}

/// Matrice 2x2 à plat : [a, b, c, d].
type Mat = [BigUint; 4];

fn mul(x: &Mat, y: &Mat) -> Mat {
    let [a, b, c, d] = x;
    let [e, f, g, h] = y;
    [a * e + b * g, a * f + b * h, c * e + d * g, c * f + d * h]
}

/// [[1,1],[1,0]]^n = [[F(n+1), F(n)], [F(n), F(n-1)]], par carrés successifs.
fn matrix(mut n: u64) -> BigUint {
    let mut result = [1u8, 0, 0, 1].map(BigUint::from);
    let mut base = [1u8, 1, 1, 0].map(BigUint::from);
    while n > 0 {
        if n & 1 == 1 {
            result = mul(&result, &base);
        }
        base = mul(&base, &base);
        n >>= 1;
    }
    // F(n) est le coin b
    let [_, f, _, _] = result;
    f
}

/// Doublement rapide : les bits de n, lus du poids fort au poids faible, font passer de (F(k), F(k+1))
/// à (F(2k), F(2k+1)); un bit à 1 avance encore d'un cran.
fn fast(n: u64) -> BigUint {
    let (mut a, mut b) = (BigUint::from(0u8), BigUint::from(1u8));
    for bit in format!("{n:b}").chars() {
        // F(2k) = F(k)·(2F(k+1) − F(k)) et F(2k+1) = F(k)² + F(k+1)²
        let even = &a * (&b * 2u8 - &a);
        let odd = &a * &a + &b * &b;
        (a, b) = if bit == '1' { (odd.clone(), even + odd) } else { (even, odd) };
    }
    a
}
