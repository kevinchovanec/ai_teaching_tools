# AI Teaching Tools

A collection of small, interactive, browser-based tools for teaching AI/ML concepts. Each tool is self-contained, static (no backend), and lives in its own subdirectory so it can be linked to directly or browsed from the [index](index.html).

## Tools

- [**Embedding Explorer**](embedding-explorer/) — type words or paragraphs and explore how a language model represents meaning as vectors: word analogies (`king − man + woman ≈ queen`), similarity, and a 2D projection of embedding space. See its own [README](embedding-explorer/README.md) for details.

## Adding a new tool

1. Create a new subdirectory at the repo root (e.g. `tokenizer-viz/`) with its own `index.html`, assets, and README.
2. Add a link + one-line description to the list above and to [index.html](index.html).
3. Keep tools static and self-contained — no shared build step, no backend. Load any large models/datasets at runtime from a CDN rather than committing them, so the repo stays light as more tools are added.

## Deployment

This repo is designed to be served as-is via GitHub Pages: each tool is reachable at `<pages-url>/<tool-directory>/`, with `index.html` at the root as the landing page.
