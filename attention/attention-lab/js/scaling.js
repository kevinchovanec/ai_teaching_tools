import { entropy, jacobianNorm, seededNormal, softmax } from "./math.js";
import { $, esc, fmt } from "./ui.js";

const DIMS = [2, 4, 8, 16, 32, 64, 128, 256, 512];
const KEYS = 8;
const TRIALS = 1000;

// For independent N(0,1) keys, q·k given q is exactly N(0, |q|²), so there is no need to draw whole key vectors.
function simulate() {
  const normal = seededNormal(12345);
  const stats = DIMS.map(() => [0, 1].map(() => ({ square: 0, entropy: 0, jacobian: [] })));
  const example = [];
  for (let t = 0; t < TRIALS; t++) {
    const g = Array.from({ length: KEYS }, normal);
    let q2 = 0;
    let drawn = 0;
    DIMS.forEach((d, i) => {
      for (; drawn < d; drawn++) q2 += normal() ** 2;
      const pair = [1, Math.sqrt(d)].map((divisor, scaled) => {
        const s = g.map((v) => (v * Math.sqrt(q2)) / divisor);
        const p = softmax(s);
        const stat = stats[i][scaled];
        stat.square += s.reduce((a, v) => a + v * v, 0);
        stat.entropy += entropy(p);
        stat.jacobian.push(jacobianNorm(p));
        return p;
      });
      if (t === 0) example.push(pair);
    });
  }
  const summary = stats.map((pair) => pair.map((s) => ({
    variance: s.square / (TRIALS * KEYS),
    entropy: s.entropy / TRIALS,
    gradient: s.jacobian.sort((a, b) => a - b)[TRIALS / 2],
  })));
  return { summary, example };
}

function chart(title, series, selected, scaled, log = false) {
  const tx = (v) => (log ? Math.log10(v) : v);
  const all = series.flat().map(tx);
  const low = log ? Math.floor(Math.min(...all)) : 0;
  const high = log ? Math.ceil(Math.max(...all)) : 1;
  const x = (i) => 40 + (i * 210) / (DIMS.length - 1);
  const y = (v) => 145 - ((tx(v) - low) / (high - low)) * 125;
  const tick = (v) => (log ? `10^${v}` : v);
  const lines = series.map((values, k) =>
    `<polyline fill="none" stroke="var(--series-${k ? 1 : 2})" stroke-width="2.5" points="${values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}"/>`);
  return `<div><h3>${esc(title)}</h3>
    <svg viewBox="0 0 270 180" role="img" aria-label="${esc(title)} against key dimension">
      <path d="M40 20V145H255" fill="none" stroke="var(--baseline)"/>
      <text x="35" y="24" text-anchor="end">${tick(high)}</text>
      <text x="35" y="148" text-anchor="end">${tick(low)}</text>
      ${[0, 4, 8].map((i) => `<text x="${x(i)}" y="162" text-anchor="middle">${DIMS[i]}</text>`).join("")}
      <text x="145" y="177" text-anchor="middle">dₖ</text>
      ${lines.join("")}
      <circle cx="${x(selected)}" cy="${y(series[scaled][selected])}" r="5" fill="var(--text-primary)"/>
    </svg></div>`;
}

export function initScaling() {
  const { summary, example } = simulate();

  function render() {
    const i = Number($("dk").value);
    const scaled = Number($("scale-on").checked);
    const now = summary[i][scaled];
    const series = (key) => [0, 1].map((k) => summary.map((pair) => pair[k][key]));

    $("dk-value").textContent = DIMS[i];
    $("dk").setAttribute("aria-valuetext", DIMS[i]);
    $("scale-summary").textContent =
      `Score variance ${fmt(now.variance)} · entropy ${fmt(now.entropy)} · median gradient ${now.gradient.toPrecision(2)}`;
    $("scale-bars").innerHTML = example[i][scaled].map((p, j) =>
      `<div class="bar"><span>key ${j + 1}</span><span class="track"><i style="width:${p * 100}%"></i></span><span>${fmt(p, 3)}</span></div>`).join("");
    $("scale-charts").innerHTML =
      chart("Score variance (log scale)", series("variance"), i, scaled, true) +
      chart("Mean entropy (1 = uniform)", series("entropy"), i, scaled) +
      chart("Median gradient (log scale)", series("gradient"), i, scaled, true);
  }

  $("dk").oninput = render;
  $("scale-on").onchange = render;
  render();
}
