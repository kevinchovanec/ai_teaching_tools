import { attention, project } from "./math.js";
import { WORDS, X, PROJECTIONS } from "./toy.js";
import { $, editor, fmt, heatmap, onPick } from "./ui.js";

const words = WORDS.filter((w) => w !== "small");
const initialX = X.filter((_, i) => WORDS[i] !== "small");
const STEPS = [
  ["Project to queries", "Q = XW_Q: what each token is looking for.", "Q"],
  ["Project to keys", "K = XW_K: what each token can be matched on.", "K"],
  ["Project to values", "V = XW_V: what each token passes on when attended to.", "V"],
  ["Compare", "S = QKᵀ: one dot product for every (query, key) pair.", "scores"],
  ["Scale", "S / √dₖ, here √3 ≈ 1.732. The next tab shows why.", "scaled"],
  ["Normalize", "A = softmax over each row, so each token’s weights sum to 1.", "weights"],
  ["Mix", "Z = AV: each output is a weighted average of the value vectors.", "output"],
];

export function initByHand() {
  let input;
  let values;
  let step = 0;
  let cell = [0, 0];
  let target = [1, 2];

  function working(name, [i, j]) {
    const joined = (a, b) => Array.from(a, (v, k) => `(${fmt(v)})(${fmt(b[k])})`).join(" + ");
    const { Q, K, V, scores, scaled, weights, output } = values;
    if ("QKV".includes(name)) {
      const W = input[`W${name}`].map((row) => row[j]);
      return `${name}[${i + 1},${j + 1}] = row ${i + 1} of X · column ${j + 1} of W_${name}\n= ${joined(input.X[i], W)}\n= ${fmt(values[name][i][j])}`;
    }
    const at = `[${i + 1},${j + 1}]`;
    if (name === "scores") return `S${at} = q(${words[i]}) · k(${words[j]})\n= ${joined(Q[i], K[j])}\n= ${fmt(scores[i][j])}`;
    if (name === "scaled") return `S${at} / √dₖ = ${fmt(scores[i][j])} / √3\n= ${fmt(scaled[i][j], 3)}`;
    if (name === "weights") {
      return `A${at} = exp(${fmt(scaled[i][j], 3)}) / (${scaled[i].map((s) => `exp(${fmt(s, 3)})`).join(" + ")})\n= ${fmt(weights[i][j], 3)}`;
    }
    return `Z${at} = row ${i + 1} of A · column ${j + 1} of V\n= ${joined(weights[i], V.map((row) => row[j]))}\n= ${fmt(output[i][j], 3)}`;
  }

  function render() {
    const projected = project(input.X, input);
    values = { ...projected, ...attention(projected.Q, projected.K, projected.V) };
    const [title, hint, name] = STEPS[step];
    const matrix = values[name];
    const square = ["scores", "scaled", "weights"].includes(name);
    cell = [cell[0], Math.min(cell[1], matrix[0].length - 1)];

    $("step-title").textContent = `${step + 1} of ${STEPS.length}: ${title}`;
    $("step-hint").textContent = hint;
    $("step-matrix").innerHTML = heatmap(matrix, {
      rows: words,
      cols: square ? words : ["dim 1", "dim 2", "dim 3"],
      pick: "step",
      selected: cell,
      digits: step > 3 ? 3 : 2,
    });
    $("step-work").textContent = working(name, cell);
    $("step-back").disabled = step === 0;
    $("step-next").disabled = step === STEPS.length - 1;
  }

  function newQuestion() {
    $("quiz-question").textContent = `How much attention does “${words[target[0]]}” pay to “${words[target[1]]}”? Use the current matrices.`;
    $("quiz-answer").value = "";
    $("quiz-feedback").textContent = "";
  }

  function reset() {
    input = structuredClone({ X: initialX, ...PROJECTIONS });
    const changed = () => {
      $("quiz-feedback").textContent = "";
      render();
    };
    editor($("edit-x"), "X", input.X, words, changed);
    for (const name of ["WQ", "WK", "WV"]) editor($(`edit-${name}`), name.replace("W", "W_"), input[name], null, changed);
    changed();
  }

  onPick($("step-matrix"), (_, i, j) => {
    cell = [i, j];
    render();
  });
  $("step-back").onclick = () => { step--; render(); };
  $("step-next").onclick = () => { step++; render(); };
  $("hand-reset").onclick = reset;
  $("quiz-form").onsubmit = (event) => {
    event.preventDefault();
    const given = $("quiz-answer").valueAsNumber;
    const [i, j] = target;
    const right = Math.abs(given - values.weights[i][j]) <= 0.01;
    $("quiz-feedback").textContent = right
      ? `Correct: ${fmt(values.weights[i][j], 3)}.`
      : "Not yet. Find the query and all three keys, take dot products, divide by √3, then apply softmax.";
    $("quiz-feedback").className = `result ${right ? "good" : "bad"}`;
  };
  $("quiz-new").onclick = () => {
    const next = (target[0] * 3 + target[1] + 4) % 9; // step 4 visits all nine cells
    target = [Math.floor(next / 3), next % 3];
    newQuestion();
  };

  reset();
  newQuestion();
}
