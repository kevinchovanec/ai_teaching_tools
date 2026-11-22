"""Regenerate ../data for Attention Lab.

    pip install torch transformers numpy
    python export_gpt2.py

Downloads GPT-2 small (about 550 MB). The page never downloads it.
"""

import json
import math
from pathlib import Path

import torch
from transformers import GPT2LMHeadModel, GPT2TokenizerFast

MODEL = "openai-community/gpt2"
REVISION = "607a30d783dfa663caf39e06633721c8d4cfcd7e"
HEADS, DK = 12, 64
OUT = Path(__file__).resolve().parent.parent / "data"
PRESETS = [
    "When Mary and John went to the store, John gave a drink to",
    "The cat sat on the mat because the cat was",
    "The animal didn't cross the street because it was too",
    "The keys to the old wooden cabinet are",
    "The Eiffel Tower is located in the city of",
    "red blue green red blue green red blue",
    "def add(a, b): return a +",
    "The bank by the river was closed, so the bank",
]


@torch.no_grad()
def main():
    tokenizer = GPT2TokenizerFast.from_pretrained(MODEL, revision=REVISION)
    model = GPT2LMHeadModel.from_pretrained(MODEL, revision=REVISION, attn_implementation="eager").eval()
    block = model.transformer.h[0]

    def top5(log_probs):
        best = log_probs.exp().topk(5)
        return [[tokenizer.decode([int(i)]), round(float(p), 5)] for p, i in zip(*best)]

    chunks, presets, offset = [], [], 0
    for text in PRESETS:
        ids = tokenizer(text, return_tensors="pt").input_ids
        n = ids.shape[1]
        x = block.ln_1(model.transformer.wte(ids) + model.transformer.wpe(torch.arange(n)[None]))
        q, k, v = [p.view(n, HEADS, DK).transpose(0, 1) for p in block.attn.c_attn(x)[0].split(768, -1)]

        future = ~torch.ones(n, n).tril().bool()
        weights = (q @ k.transpose(1, 2) / math.sqrt(DK)).masked_fill(future, -math.inf).softmax(-1)
        result = model(ids, output_attentions=True)
        # Refuse to export anything that doesn't reproduce the model's own attention.
        assert (weights - result.attentions[0][0]).abs().max() < 1e-5, text
        original = result.logits[0, -1].log_softmax(-1)

        ablations = []
        for head in range(HEADS):
            part = (weights[head] @ v[head]) @ block.attn.c_proj.weight[head * DK:(head + 1) * DK]
            hook = block.attn.register_forward_hook(
                lambda module, inputs, output: (output[0] - part[None],) + tuple(output[1:])
            )
            changed = model(ids).logits[0, -1].log_softmax(-1)
            hook.remove()
            kl = float((original.exp() * (original - changed)).sum())
            ablations.append({"kl": round(kl, 6), "top": top5(changed)})

        presets.append({
            "text": text,
            "tokens": [tokenizer.decode([i]) for i in ids[0].tolist()],
            "offset": offset,
            "top": top5(original),
            "ablations": ablations,
        })
        for part in (q, k, v):
            values = part.numpy().astype("<f4")
            chunks.append(values.tobytes())
            offset += values.size

    OUT.mkdir(exist_ok=True)
    (OUT / "projections.bin").write_bytes(b"".join(chunks))
    meta = {"model": MODEL, "revision": REVISION, "heads": HEADS, "dk": DK, "presets": presets}
    (OUT / "presets.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(presets)} presets, {offset * 4:,} bytes of vectors, to {OUT}")


if __name__ == "__main__":
    main()
