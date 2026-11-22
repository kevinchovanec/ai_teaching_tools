import { attention, positional, project } from "./math.js";
import { WORDS, X, PROJECTIONS } from "./toy.js";
import { tokenLabels } from "./gpt2-data.js";
import { $, esc, fmt, heatmap, options } from "./ui.js";

// Each experiment stays hidden until the learner commits to a prediction.
function prediction(id, answer, explanation) {
  $(`${id}-choices`).onclick = (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    for (const choice of $(`${id}-choices`).children) choice.setAttribute("aria-pressed", choice === button);
    const right = button.dataset.answer === answer;
    $(`${id}-feedback`).textContent = `${right ? "Right." : "Not quite."} ${explanation}`;
    $(`${id}-feedback`).className = `result ${right ? "good" : "bad"}`;
    $(`${id}-reveal`).hidden = false;
  };
}

export function initShuffle() {
  const order = [3, 1, 0, 2];
  prediction("shuffle", "same", "Without positions, each token’s output moves with it and is otherwise identical. This is permutation equivariance.");

  function render() {
    const position = positional(4, 4);
    const run = (rows) => {
      const input = $("shuffle-pe").checked ? rows.map((row, i) => row.map((v, j) => v + position[i][j])) : rows;
      const { Q, K, V } = project(input, PROJECTIONS);
      return attention(Q, K, V).output;
    };
    const original = run(X);
    const shuffled = run(order.map((i) => X[i]));
    const realigned = WORDS.map((_, i) => shuffled[order.indexOf(i)]);
    const gap = Math.max(...original.flatMap((row, i) => row.map((v, j) => Math.abs(v - realigned[i][j]))));
    $("shuffle-output").innerHTML = `<div class="grid">
      <div><h3>Original: ${WORDS.join(" ")}</h3>${heatmap(original, { rows: WORDS, digits: 3 })}</div>
      <div><h3>Shuffled: ${order.map((i) => WORDS[i]).join(" ")} (rows realigned)</h3>${heatmap(realigned, { rows: WORDS, digits: 3 })}</div>
      </div><p class="result">Largest difference: ${fmt(gap, 4)}</p>`;
  }

  $("shuffle-pe").onchange = render;
  render();
}

export function initSymmetry(data) {
  prediction("symmetry", "scores", "QQᵀ is symmetric, but softmax normalizes each row separately, so A generally is not.");
  $("symmetry-head").innerHTML = options(Array.from({ length: data.heads }, (_, h) => `Head ${h}`), 7);

  function render() {
    const preset = data.presets[1];
    const labels = tokenLabels(preset.tokens);
    const { Q, K, V } = data.projections(preset, Number($("symmetry-head").value));
    const { scores, weights } = attention(Q, $("symmetry-tie").checked ? Q : K, V);
    $("symmetry-output").innerHTML = [["Scores S", scores, 1], ["Weights A", weights, 2]].map(([name, m, digits]) => {
      const gap = Math.max(...m.flatMap((row, i) => row.map((v, j) => Math.abs(v - m[j][i]))));
      return `<h3>${name}: largest |Mᵢⱼ − Mⱼᵢ| = ${fmt(gap, 3)}</h3>${heatmap(m, { rows: labels, cols: labels, digits })}`;
    }).join("");
  }

  $("symmetry-head").onchange = render;
  $("symmetry-tie").onchange = render;
  render();
}

export function initAblation(data) {
  prediction("ablation", "unknown", "A weight says where a head reads from. It says nothing about what is in V or how later layers use it.");
  $("ablation-preset").innerHTML = options(data.presets.map((p) => p.text), 1);
  $("ablation-head").innerHTML = options(Array.from({ length: data.heads }, (_, h) => `Head ${h}`), 1);

  function render() {
    const preset = data.presets[$("ablation-preset").value];
    const selected = Number($("ablation-head").value);
    const last = preset.tokens.length - 1;
    const token = (value) => esc(JSON.stringify(value));
    const rows = preset.ablations.map((result, h) => {
      const { Q, K, V } = data.projections(preset, h);
      return { h, kl: result.kl, peak: Math.max(...attention(Q, K, V, "causal").weights[last]), top: result.top[0] };
    });
    const sharpest = rows.reduce((a, b) => (b.peak > a.peak ? b : a));
    const strongest = rows.reduce((a, b) => (b.kl > a.kl ? b : a));
    const predictions = (title, top) => `<div><h3>${title}</h3><table class="data">${top.map(([t, p]) =>
      `<tr><th>${token(t)}</th><td>${fmt(p * 100, 1)}%</td></tr>`).join("")}</table></div>`;

    $("ablation-output").innerHTML = `
      <p class="result">Sharpest attention: head ${sharpest.h}. Largest effect when removed: head ${strongest.h}.</p>
      <div class="grid">${predictions("All heads", preset.top)}${predictions(`Without head ${selected}`, preset.ablations[selected].top)}</div>
      <h3>All 12 heads</h3>
      <div class="scroll"><table class="data">
        <tr><th>head</th><th>peak weight, last token</th><th>effect (KL, nats)</th><th>top token without it</th></tr>
        ${rows.map((r) => `<tr><th>${r.h}${r.h === selected ? " (selected)" : ""}</th><td>${fmt(r.peak)}</td><td>${fmt(r.kl, 4)}</td><td>${token(r.top[0])}</td></tr>`).join("")}
      </table></div>`;
  }

  $("ablation-preset").onchange = render;
  $("ablation-head").onchange = render;
  render();
}
