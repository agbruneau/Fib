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
    /// Dans l'ordre de la comparaison (alphabétique).
    pub const ALL: [Algo; 3] = [Algo::Fast, Algo::Iterative, Algo::Matrix];

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

pub fn fib(n: u64, algo: Algo) -> BigUint {
    match algo {
        Algo::Iterative => iterative(n),
        Algo::Matrix => matrix(n),
        Algo::Fast => fast(n),
    }
}

/// [[1,1],[1,0]]^n = [[F(n+1), F(n)], [F(n), F(n-1)]], par carrés successifs. Matrice 2x2 à plat : [a, b, c, d].
type Mat = [BigUint; 4];

fn mul(x: &Mat, y: &Mat) -> Mat {
    [
        &x[0] * &y[0] + &x[1] * &y[2],
        &x[0] * &y[1] + &x[1] * &y[3],
        &x[2] * &y[0] + &x[3] * &y[2],
        &x[2] * &y[1] + &x[3] * &y[3],
    ]
}

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
    let [_, f, _, _] = result;
    f
}

/// Doublement rapide : à chaque bit de n, (F(k), F(k+1)) devient (F(2k), F(2k+1)); un bit à 1 avance encore d'un cran.
fn fast(n: u64) -> BigUint {
    let (mut a, mut b) = (BigUint::from(0u8), BigUint::from(1u8));
    for i in (0..u64::BITS - n.leading_zeros()).rev() {
        let c = &a * (&b * 2u8 - &a);
        let d = &a * &a + &b * &b;
        (a, b) = if n >> i & 1 == 1 { (d.clone(), c + d) } else { (c, d) };
    }
    a
}

/// F(0) … F(n), toujours par l'algorithme iterative.
pub fn fib_list(n: u64) -> Vec<BigUint> {
    let n = n as usize;
    let mut terms = vec![BigUint::from(0u8), BigUint::from(1u8)];
    for i in 2..=n {
        terms.push(&terms[i - 1] + &terms[i - 2]);
    }
    terms.truncate(n + 1);
    terms
}

fn iterative(n: u64) -> BigUint {
    let (mut a, mut b) = (BigUint::from(0u8), BigUint::from(1u8));
    for _ in 0..n {
        std::mem::swap(&mut a, &mut b);
        b += &a;
    }
    a
}
