import { attention, project } from "./math.js";
import { WORDS, X, PROJECTIONS } from "./toy.js";
import { $, editor, fmt, heatmap } from "./ui.js";

export function initMasking() {
  let edited;

  function render() {
    const mode = $("mask-mode").value;
    const run = (input) => {
      const { Q, K, V } = project(input, PROJECTIONS);
      return attention(Q, K, V, mode);
    };
    const before = run(X);
    const after = run(edited);

    $("mask-scores").innerHTML = heatmap(after.masked, { rows: WORDS, cols: WORDS });
    $("mask-weights").innerHTML = heatmap(after.weights.map((row) => [...row, row.reduce((a, b) => a + b, 0)]), {
      rows: WORDS,
      cols: [...WORDS, "sum"],
    });

    const firstEdit = X.findIndex((row, i) => row.some((v, j) => v !== edited[i][j]));
    $("mask-change").innerHTML = `<div class="scroll"><table class="data">
      <tr><th>output</th><th>change ‖ΔZ‖</th><th>verdict</th></tr>
      ${WORDS.map((word, i) => {
        const change = Math.hypot(...after.output[i].map((v, j) => v - before.output[i][j]));
        let verdict = "can see the edit";
        if (firstEdit < 0) verdict = "no edit yet";
        else if (i < firstEdit) {
          verdict = change > 1e-12 ? '<span class="bad">future leaked</span>' : '<span class="good">unaffected</span>';
        }
        return `<tr><th>${word}</th><td>${fmt(change, 4)}</td><td>${verdict}</td></tr>`;
      }).join("")}</table></div>`;
  }

  function load(change) {
    edited = structuredClone(X);
    change?.(edited);
    editor($("mask-x"), "X", edited, WORDS, render);
    render();
  }

  $("mask-mode").onchange = render;
  $("mask-edit").onclick = () => load((m) => { m[3] = [0, 3, 2, 1]; });
  $("mask-reset").onclick = () => load();
  load((m) => { m[3] = [0, 3, 2, 1]; });
}
