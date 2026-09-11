# Embedding Explorer

An interactive, static (no backend) website for exploring word and sentence embeddings in the browser.

## Features
- Type a word, see its embedding vector
- Vector arithmetic / analogies (`king - man + woman = ?`) using a trimmed GloVe word-vector table
- Cosine similarity between any two words or paragraphs
- Paragraph/sentence embeddings via a small transformer model run client-side ([transformers.js](https://github.com/xenova/transformers.js), `all-MiniLM-L6-v2`)
- 2D projection (PCA) scatter plot of embedded items

## Why two models?
Word-level analogies (`king - man + woman ≈ queen`) work best with classic static word vectors (GloVe), not contextual sentence embeddings. Paragraph similarity needs open vocabulary + context, which GloVe can't do well. So this uses:
1. A trimmed GloVe 100d table (top 15,000 most frequent words) for word analogies/similarity — small static asset, no model download.
2. `all-MiniLM-L6-v2` via transformers.js for paragraph embeddings — downloaded once by the browser and cached.

Both run **entirely client-side**. No API keys, no server, no per-use cost.

## Local development
This is a plain static site — no build step. Serve it with any static file server, e.g.:

```
npx serve .
```

or

```
python -m http.server 8000
```

Then open the printed local URL in a browser.

## Deployment
Push to GitHub and enable GitHub Pages (Settings → Pages → deploy from branch), or use any static host.

## Data
`data/glove.6B.100d.top15k.txt` is a trimmed excerpt of Stanford's [GloVe](https://nlp.stanford.edu/projects/glove/) 6B 100-dimensional vectors (top 15,000 most frequent words, which is how the source file is ordered). GloVe is released under the [Open Data Commons Public Domain Dedication and License (PDDL)](https://opendatacommons.org/licenses/pddl/1-0/).
