# AI Teaching Tools

A collection of teaching resources for AI/ML concepts, organized by topic. Each topic folder can hold a notebook, an interactive browser-based tool, or both. Interactive tools are static (no backend) and self-contained, so they can be linked to directly or browsed from the [index](index.html).

## Topics

- [**Embeddings**](embeddings/) — [a walkthrough notebook](embeddings/embeddings.ipynb) (word vectors, analogies, a bias cautionary example, document embeddings) plus the [Embedding Explorer](embeddings/embedding-explorer/) interactive tool covering the same ground hands-on. See [embeddings/README.md](embeddings/README.md).

## Adding a new topic

1. Create a new subdirectory at the repo root (e.g. `tokenization/`) with whatever mix of notebook(s) and interactive tool(s) fits the topic, plus a short README.
2. If it includes an interactive tool, give it its own subdirectory with `index.html`, assets, and README — keep it static and self-contained, no shared build step, no backend. Load any large models/datasets at runtime from a CDN rather than committing them, so the repo stays light as more topics are added.
3. Add a link + one-line description to the list above and to [index.html](index.html).

## Deployment

This repo is designed to be served as-is via GitHub Pages: each interactive tool is reachable at `<pages-url>/<topic>/<tool-directory>/`, with `index.html` at the root as the landing page. Notebooks aren't served by Pages — view them on GitHub, where `.ipynb` files render natively.
