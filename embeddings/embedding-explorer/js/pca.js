// Minimal 2D PCA via the Gram-matrix ("dual PCA") trick: for N items in a
// high-dimensional space, eigen-decomposing the N x N Gram matrix is far
// cheaper than the D x D covariance matrix and gives identical scores.

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalizeInPlace(v) {
  let n = Math.sqrt(dot(v, v));
  if (n < 1e-12) n = 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

function powerIteration(G, iterations = 200) {
  const n = G.length;
  let u = new Float64Array(n).map(() => Math.random() - 0.5);
  normalizeInPlace(u);
  let eigenvalue = 0;
  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      const row = G[i];
      for (let j = 0; j < n; j++) s += row[j] * u[j];
      next[i] = s;
    }
    eigenvalue = Math.sqrt(dot(next, next));
    if (eigenvalue < 1e-10) return { u: next, eigenvalue: 0 };
    for (let i = 0; i < n; i++) next[i] /= eigenvalue;
    u = next;
  }
  return { u, eigenvalue };
}

/**
 * Projects N vectors (each an array of the same length) onto their top-2
 * principal components. Returns an array of [x, y] pairs, same order as input.
 */
export function pca2D(vectors) {
  const n = vectors.length;
  const d = vectors[0].length;
  if (n === 1) return [[0, 0]];

  const mean = new Float64Array(d);
  for (const v of vectors) for (let k = 0; k < d; k++) mean[k] += v[k];
  for (let k = 0; k < d; k++) mean[k] /= n;

  const X = vectors.map((v) => {
    const c = new Float64Array(d);
    for (let k = 0; k < d; k++) c[k] = v[k] - mean[k];
    return c;
  });

  const G = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const v = dot(X[i], X[j]);
      G[i][j] = v;
      G[j][i] = v;
    }
  }

  const { u: u1, eigenvalue: s1 } = powerIteration(G);

  const G2 = G.map((row, i) => Float64Array.from(row, (val, j) => val - s1 * u1[i] * u1[j]));
  const { u: u2, eigenvalue: s2 } = powerIteration(G2);

  const sigma1 = Math.sqrt(Math.max(s1, 0));
  const sigma2 = Math.sqrt(Math.max(s2, 0));

  return Array.from({ length: n }, (_, i) => [u1[i] * sigma1, u2[i] * sigma2]);
}
