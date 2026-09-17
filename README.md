# AI Teaching Tools

A collection of teaching resources for AI/ML concepts. **Topics** are organized by subject and hold a notebook, an interactive browser-based tool, or both, meant for individual/self-paced learning. **Workshops** are facilitation activities meant to be run live with a group. Interactive pages are static (no backend) and self-contained, so they can be linked to directly or browsed from the [index](index.html).

## Topics

- [**Embeddings**](embeddings/) — [a walkthrough notebook](embeddings/embeddings.ipynb) (word vectors, analogies, a bias cautionary example, document embeddings) plus the [Embedding Explorer](embeddings/embedding-explorer/) interactive tool covering the same ground hands-on. See [embeddings/README.md](embeddings/README.md).

## Workshops

- [**Tinker Group Cards**](workshops/tinker-groups/) — a small-group discussion activity for AI-adoption workshops: draw a stakeholder-concern card, work it through with assigned roles, then a twist card complicates things partway through. See [workshops/tinker-groups/README.md](workshops/tinker-groups/README.md).

## Adding a new topic or workshop

1. Create a new subdirectory at the repo root (topics) or under `workshops/` (workshop activities), with whatever mix of notebook(s), interactive page(s), and a short README fits.
2. If it includes an interactive page, give it its own subdirectory with `index.html`, assets, and README — keep it static and self-contained, no shared build step, no backend. Load any large models/datasets at runtime from a CDN rather than committing them, so the repo stays light as more are added.
3. Add a link + one-line description to the relevant list above and to [index.html](index.html).

## Deployment

This repo is designed to be served as-is via GitHub Pages: each interactive page is reachable at its own subdirectory path (e.g. `<pages-url>/embeddings/embedding-explorer/`, `<pages-url>/workshops/tinker-groups/`), with `index.html` at the root as the landing page. Notebooks aren't served by Pages — view them on GitHub, where `.ipynb` files render natively.
