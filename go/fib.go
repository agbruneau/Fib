// Package fib calcule les termes de la suite de Fibonacci en précision arbitraire (math/big).
package fib

import (
	"fmt"
	"math/big"
	"math/bits"
)

// Fib rend F(n) par l'algorithme algo.
func Fib(n int, algo string) (*big.Int, error) {
	if n < 0 {
		return nil, fmt.Errorf("indice negatif : %d", n)
	}
	switch algo {
	case "iterative":
		return iterative(n), nil
	case "fast":
		return fast(n), nil
	case "matrix":
		return matrix(n), nil
	}
	return nil, fmt.Errorf("algorithme inconnu : %+q", algo)
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

// matrix élève [[1,1],[1,0]] à la puissance n par carrés successifs : le résultat est [[F(n+1), F(n)], [F(n), F(n-1)]].
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

// fast suit les bits de n, du plus fort au plus faible, pour passer de (F(k), F(k+1)) à (F(2k), F(2k+1)).
func fast(n int) *big.Int {
	a, b := big.NewInt(0), big.NewInt(1) // F(k), F(k+1) pour k = 0
	for i := bits.Len(uint(n)) - 1; i >= 0; i-- {
		even := new(big.Int).Lsh(b, 1) // F(2k) = F(k) * (2F(k+1) - F(k))
		even.Sub(even, a).Mul(even, a)
		odd := new(big.Int).Mul(a, a) // F(2k+1) = F(k)^2 + F(k+1)^2
		odd.Add(odd, new(big.Int).Mul(b, b))
		if n>>i&1 == 1 {
			a, b = odd, even.Add(even, odd)
		} else {
			a, b = even, odd
		}
	}
	return a
}

// FibList rend F(0) … F(n), générée par l'algorithme iterative.
func FibList(n int) ([]*big.Int, error) {
	if n < 0 {
		return nil, fmt.Errorf("indice negatif : %d", n)
	}
	list := make([]*big.Int, 0, n+1)
	a, b := big.NewInt(0), big.NewInt(1)
	for range n + 1 {
		list = append(list, a)
		a, b = b, new(big.Int).Add(a, b)
	}
	return list, nil
}

// iterative applique la définition indice par indice, avec deux termes consécutifs en mémoire.
func iterative(n int) *big.Int {
	a, b := big.NewInt(0), big.NewInt(1)
	for range n {
		a.Add(a, b)
		a, b = b, a
	}
	return a
}
