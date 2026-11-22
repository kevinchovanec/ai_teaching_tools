# Attention Lab

An interactive, static lesson on scaled dot-product attention, for learners who know matrix multiplication, softmax, and basic gradients.

## Lessons

Each tab can be linked directly.

| Tab | Link | By the end, learners can |
|---|---|---|
| By hand | `#hand` | compute any score, weight, or output from X and the projection matrices |
| Why √dₖ? | `#scaling` | derive the score variance and explain softmax saturation |
| Masking | `#masking` | explain why the mask must be applied before softmax |
| Inside GPT-2 | `#gpt2` | trace a real attention weight to its query and key vectors |
| Break it | `#experiments` | explain permutation equivariance, the role of separate Q and K, and why attention weights are not explanations |

## What is real and what is simplified

- **By hand, Masking, Shuffle:** small made-up matrices with the exact equations.
- **Why √dₖ?:** a seeded simulation with random Gaussian vectors.
- **Inside GPT-2, Set Q = K:** real first-layer vectors from GPT-2 small, with attention computed in the browser.
- **Remove a head:** precomputed with the full 12-layer model. This is zero ablation, which has limits that the page explains.

Sentences are presets, so nothing a learner types is sent anywhere and no model is downloaded.

## Local development

There is no build step, but ES modules need a server:

```
python -m http.server 8000
```

## Data

`data/` holds about 0.8 MB derived from [openai-community/gpt2](https://huggingface.co/openai-community/gpt2), pinned to a revision:

- `projections.bin`: little-endian float32. For each preset, Q, then K, then V, each shaped `[head, token, 64]`.
- `presets.json`: tokens, offsets (counted in floats), top predictions, and ablation results.

To change the sentences, edit `PRESETS` in [scripts/export_gpt2.py](scripts/export_gpt2.py) and run it. It stops if the exported vectors don't reproduce the model's own attention. The note under the head thumbnails and the default sentence in two experiments refer to the first two presets, so update those if you replace them.
