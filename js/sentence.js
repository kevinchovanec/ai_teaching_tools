// Wraps transformers.js to embed arbitrary text (words, phrases, paragraphs)
// with a small sentence-transformer model, running entirely in the browser.

let pipelinePromise = null;

async function getExtractor(onProgress) {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import(
        "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2"
      );
      env.allowLocalModels = false;
      return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
        progress_callback: onProgress,
      });
    })();
  }
  return pipelinePromise;
}

/** Returns a normalized embedding (Array<number>, 384-dim) for the given text. */
export async function embedText(text, onProgress) {
  const extractor = await getExtractor(onProgress);
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/** Embeds multiple texts, reusing the same loaded model. */
export async function embedBatch(texts, onProgress) {
  const extractor = await getExtractor(onProgress);
  const results = [];
  for (const t of texts) {
    const output = await extractor(t, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data));
  }
  return results;
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
