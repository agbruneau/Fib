// Package fib calcule les termes de la suite de Fibonacci en précision arbitraire (math/big).
package fib

import (
	"fmt"
	"math/big"
	"strconv"
)

// Fib rend F(n) par l'algorithme algo (iterative, matrix ou fast); elle refuse un indice négatif et tout autre nom.
func Fib(n int, algo string) (*big.Int, error) {
	if n < 0 {
		return nil, fmt.Errorf("indice negatif : %d", n)
	}
	switch algo {
	case "iterative":
		return iterative(n), nil
	case "matrix":
		return matrix(n), nil
	case "fast":
		return fast(n), nil
	}
	return nil, fmt.Errorf("algorithme inconnu : %+q", algo)
}

// FibList rend F(0) … F(n), toujours par l'algorithme iterative; elle refuse un indice négatif.
func FibList(n int) ([]*big.Int, error) {
	if n < 0 {
		return nil, fmt.Errorf("indice negatif : %d", n)
	}
	a, b := big.NewInt(0), big.NewInt(1)
	list := []*big.Int{a}
	for range n {
		a, b = b, new(big.Int).Add(a, b)
		list = append(list, a)
	}
	return list, nil
}

// iterative applique la définition indice par indice, avec deux termes consécutifs en mémoire.
func iterative(n int) *big.Int {
	a, b := big.NewInt(0), big.NewInt(1)
	for range n {
		a, b = b, new(big.Int).Add(a, b)
	}
	return a
}

type mat [2][2]*big.Int

func newMat(a, b, c, d int64) mat {
	return mat{{big.NewInt(a), big.NewInt(b)}, {big.NewInt(c), big.NewInt(d)}}
}

func (x mat) mul(y mat) mat {
	var z mat
	for i := range 2 {
		for j := range 2 {
			z[i][j] = new(big.Int).Mul(x[i][0], y[0][j])
			z[i][j].Add(z[i][j], new(big.Int).Mul(x[i][1], y[1][j]))
		}
	}
	return z
}

// matrix : [[1,1],[1,0]]^n = [[F(n+1), F(n)], [F(n), F(n-1)]], par carrés successifs.
func matrix(n int) *big.Int {
	result, base := newMat(1, 0, 0, 1), newMat(1, 1, 1, 0)
	for ; n > 0; n >>= 1 {
		if n&1 == 1 {
			result = result.mul(base)
		}
		base = base.mul(base)
	}
	return result[0][1]
}

// fast est le doublement rapide : (F(k), F(k+1)) devient (F(2k), F(2k+1)) à chaque bit de n, du poids fort
// au poids faible; un bit à 1 avance encore d'un cran.
func fast(n int) *big.Int {
	a, b := big.NewInt(0), big.NewInt(1) // F(k), F(k+1) pour k = 0
	for _, bit := range strconv.FormatInt(int64(n), 2) {
		// F(2k) = F(k)·(2F(k+1) − F(k))
		even := new(big.Int).Lsh(b, 1)
		even.Sub(even, a)
		even.Mul(even, a)
		// F(2k+1) = F(k)² + F(k+1)²
		odd := new(big.Int).Mul(a, a)
		odd.Add(odd, new(big.Int).Mul(b, b))
		if bit == '1' {
			a, b = odd, new(big.Int).Add(even, odd)
		} else {
			a, b = even, odd
		}
	}
	return a
}
