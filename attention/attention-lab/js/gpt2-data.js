async function get(path, type) {
  const response = await fetch(new URL(`../data/${path}`, import.meta.url));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response[type]();
}

export async function loadData() {
  const [meta, buffer] = await Promise.all([get("presets.json", "json"), get("projections.bin", "arrayBuffer")]);
  const all = new Float32Array(buffer); // little-endian, like every current browser platform

  // Per preset: Q, then K, then V, each shaped [head][token][64].
  meta.projections = (preset, head) => {
    const n = preset.tokens.length;
    const size = meta.heads * n * meta.dk;
    const [Q, K, V] = [0, 1, 2].map((part) => Array.from({ length: n }, (_, t) => {
      const start = preset.offset + part * size + (head * n + t) * meta.dk;
      return all.subarray(start, start + meta.dk);
    }));
    return { Q, K, V };
  };
  return meta;
}

// Show leading spaces, and number repeated tokens by occurrence: "·John (1)", "·John (2)".
export const tokenLabels = (tokens) =>
  tokens.map((token, i) => {
    const name = token.replace(/^ /, "·");
    if (tokens.indexOf(token) === tokens.lastIndexOf(token)) return name;
    return `${name} (${tokens.slice(0, i + 1).filter((t) => t === token).length})`;
  });
