import { attention } from "./math.js";
import { tokenLabels } from "./gpt2-data.js";
import { $, esc, fmt, heatmap, onPick, options } from "./ui.js";

export function initGpt2(data) {
  let preset;
  let runs;
  let labels;
  let head = 1;
  let cell;

  function thumbnail(A, h) {
    const n = A.length;
    const rects = A.flatMap((row, i) => row.map((v, j) =>
      `<rect x="${j}" y="${i}" width="1" height="1" fill="var(--series-1)" fill-opacity="${v.toFixed(3)}"/>`));
    return `<button data-pick="head" data-i="${h}" data-j="0" aria-pressed="${h === head}">Head ${h}
      <svg viewBox="0 0 ${n} ${n}" aria-hidden="true">${rects.join("")}</svg></button>`;
  }

  function render() {
    const { Q, K, V, masked, scores, scaled, weights, output } = runs[head];
    const [i, j] = cell;
    $("head-list").innerHTML = runs.map((run, h) => thumbnail(run.weights, h)).join("");
    $("head-title").textContent = `Head ${head}: attention weights`;
    $("head-matrix").innerHTML = heatmap(weights, { rows: labels, cols: labels, pick: "weight", selected: cell, label: "attention" });
    $("trace-title").textContent = `“${labels[i]}” attending to “${labels[j]}”`;

    const products = Array.from(Q[i], (v, d) => v * K[j][d]);
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    const line = (name, values, rest = "", total = "") =>
      `<tr><th>${name}</th>${Array.from(values.slice(0, 8), (v) => `<td>${fmt(v)}</td>`).join("")}<td>${rest}</td><td>${total}</td></tr>`;
    $("trace-vectors").innerHTML = `<div class="scroll"><table class="data">
      <tr><th>dimension</th>${Array.from({ length: 8 }, (_, d) => `<th>${d + 1}</th>`).join("")}<th>9–64</th><th>total</th></tr>
      ${line("q", Q[i], "…")}${line("k", K[j], "…")}
      ${line("q × k", products, fmt(sum(products.slice(8))), fmt(scores[i][j]))}
      ${line("v", V[j], "…")}${line("z", output[i], "…")}
    </table></div>`;

    const future = j > i;
    $("trace-work").textContent = [
      `q · k = ${fmt(scores[i][j], 3)}`,
      `÷ √64 = ${fmt(scaled[i][j], 3)}`,
      future ? "+ mask = −∞, because this key is in the future" : "+ mask = unchanged, because this key is not in the future",
      `softmax over ${i + 1} visible key${i ? "s" : ""}:`,
      future
        ? "weight = 0"
        : `exp(${fmt(masked[i][j], 3)}) / (${masked[i].slice(0, i + 1).map((s) => `exp(${fmt(s, 2)})`).join(" + ")}) = ${fmt(weights[i][j], 4)}`,
      `z = weighted sum of the v vectors; this token contributes ${fmt(weights[i][j], 4)} × v`,
    ].join("\n");
  }

  function choose() {
    preset = data.presets[$("preset").value];
    labels = tokenLabels(preset.tokens);
    runs = Array.from({ length: data.heads }, (_, h) => {
      const p = data.projections(preset, h);
      return { ...p, ...attention(p.Q, p.K, p.V, "causal") };
    });
    // Start on the first repeated content word, if there is one.
    const { tokens } = preset;
    const repeat = tokens.findIndex((t, i) => t.trim().length > 3 && tokens.indexOf(t) < i);
    cell = repeat >= 0 ? [repeat, tokens.indexOf(tokens[repeat])] : [tokens.length - 1, 0];
    $("preset-note").innerHTML = `${tokens.length} tokens. “·” marks a leading space. GPT-2’s top next token: <b>${esc(JSON.stringify(preset.top[0][0]))}</b> (${fmt(preset.top[0][1] * 100, 1)}%).`;
    render();
  }

  onPick($("gpt2-content"), (name, i, j) => {
    if (name === "head") head = i;
    else cell = [i, j];
    render();
  });
  $("preset").innerHTML = options(data.presets.map((p) => p.text));
  $("preset").onchange = choose;
  choose();
}
