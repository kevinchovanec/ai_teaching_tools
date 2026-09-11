// Loads a trimmed GloVe word-vector table and provides vector math / nearest-neighbor search.

const DATA_URL = "data/glove.6B.100d.top15k.txt";
const DB_NAME = "embedding-explorer";
const DB_VERSION = 1;
const STORE = "glove-cache";
const CACHE_KEY = "glove.6B.100d.top15k.v1";

let dim = 0;
let words = [];              // index -> word
let indexByWord = new Map(); // word -> index
let matrix = null;           // Float32Array, N * dim, row-major
let norms = null;            // Float32Array, N

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readCache() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(CACHE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeCache(payload) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(payload, CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // caching is a best-effort optimization; ignore failures (private browsing, quota, etc.)
  }
}

function parseText(text) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const n = lines.length;
  const first = lines[0].trim().split(" ");
  dim = first.length - 1;

  words = new Array(n);
  matrix = new Float32Array(n * dim);
  norms = new Float32Array(n);
  indexByWord = new Map();

  for (let i = 0; i < n; i++) {
    const parts = lines[i].trim().split(" ");
    const word = parts[0];
    words[i] = word;
    indexByWord.set(word, i);
    let sumSq = 0;
    for (let d = 0; d < dim; d++) {
      const v = parseFloat(parts[d + 1]);
      matrix[i * dim + d] = v;
      sumSq += v * v;
    }
    norms[i] = Math.sqrt(sumSq);
  }
}

export async function loadGlove(onStatus) {
  onStatus?.("Checking cache…");
  const cached = await readCache();
  if (cached && cached.dim && cached.words && cached.matrixBuffer) {
    dim = cached.dim;
    words = cached.words;
    matrix = new Float32Array(cached.matrixBuffer);
    norms = new Float32Array(cached.normsBuffer);
    indexByWord = new Map(words.map((w, i) => [w, i]));
    onStatus?.("Word vectors ready (from cache)");
    return;
  }

  onStatus?.("Downloading word vectors (~13 MB, first time only)…");
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to fetch ${DATA_URL}: ${res.status}`);
  const text = await res.text();

  onStatus?.("Parsing word vectors…");
  parseText(text);

  onStatus?.("Word vectors ready");
  writeCache({
    dim,
    words,
    matrixBuffer: matrix.buffer.slice(0),
    normsBuffer: norms.buffer.slice(0),
  });
}

export function getDim() {
  return dim;
}

export function hasWord(word) {
  return indexByWord.has(word.toLowerCase());
}

export function getVector(word) {
  const i = indexByWord.get(word.toLowerCase());
  if (i === undefined) return null;
  return matrix.slice(i * dim, i * dim + dim);
}

export function vocabSize() {
  return words.length;
}

export function addVec(a, b) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

export function subVec(a, b) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

export function norm(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

export function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find the top-k words whose vectors are most cosine-similar to `query`.
 * `exclude` is a list of words (case-insensitive) to omit from results.
 */
export function nearest(query, k = 8, exclude = []) {
  const excludeSet = new Set(exclude.map((w) => w.toLowerCase()));
  let qNorm = 0;
  for (let d = 0; d < dim; d++) qNorm += query[d] * query[d];
  qNorm = Math.sqrt(qNorm);
  if (qNorm === 0) return [];

  const n = words.length;
  const heap = []; // simple array-based top-k, fine for n ~ 15,000

  for (let i = 0; i < n; i++) {
    if (excludeSet.has(words[i])) continue;
    const base = i * dim;
    let dot = 0;
    for (let d = 0; d < dim; d++) dot += query[d] * matrix[base + d];
    const sim = norms[i] === 0 ? 0 : dot / (qNorm * norms[i]);
    heap.push([sim, i]);
  }

  heap.sort((a, b) => b[0] - a[0]);
  return heap.slice(0, k).map(([sim, i]) => ({ word: words[i], similarity: sim }));
}
