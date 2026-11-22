// Attention math with no DOM access. A matrix is an array of rows.

export const dot = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

export const transpose = (m) => Array.from(m[0], (_, j) => m.map((row) => row[j]));

export function matmul(a, b) {
  const columns = transpose(b);
  return a.map((row) => columns.map((column) => dot(row, column)));
}

/** Softmax that tolerates -Infinity entries (at least one entry must be finite). */
export function softmax(values) {
  const max = Math.max(...values);
  const exp = Array.from(values, (v) => Math.exp(v - max));
  const total = exp.reduce((a, b) => a + b, 0);
  return exp.map((v) => v / total);
}

/**
 * mask is one of:
 *   "none"   every token sees every token
 *   "causal" future scores become -Infinity before softmax (correct)
 *   "late"   future weights are zeroed after softmax (deliberately wrong)
 */
export function attention(Q, K, V, mask = "none") {
  const root = Math.sqrt(K[0].length);
  const scores = Q.map((q) => K.map((k) => dot(q, k)));
  const scaled = scores.map((row) => row.map((s) => s / root));
  const masked = scaled.map((row, i) => row.map((s, j) => (mask === "causal" && j > i ? -Infinity : s)));
  const weights = masked
    .map(softmax)
    .map((row, i) => row.map((w, j) => (mask === "late" && j > i ? 0 : w)));
  return { scores, scaled, masked, weights, output: matmul(weights, V) };
}

export function project(X, { WQ, WK, WV }) {
  return { Q: matmul(X, WQ), K: matmul(X, WK), V: matmul(X, WV) };
}

export function positional(n, d) {
  return Array.from({ length: n }, (_, pos) =>
    Array.from({ length: d }, (_, i) => {
      const angle = pos / 10000 ** (2 * Math.floor(i / 2) / d);
      return i % 2 ? Math.cos(angle) : Math.sin(angle);
    }));
}

/** Frobenius norm of the softmax Jacobian, diag(p) - p p^T. */
export function jacobianNorm(p) {
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < p.length; j++) sum += ((i === j ? p[i] : 0) - p[i] * p[j]) ** 2;
  }
  return Math.sqrt(sum);
}

export function entropy(p) {
  return p.reduce((sum, x) => (x > 0 ? sum - x * Math.log(x) : sum), 0) / Math.log(p.length);
}

export function seededNormal(seed) {
  let state = seed;
  const uniform = () => (state = (state * 16807) % 2147483647) / 2147483647;
  return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
}
