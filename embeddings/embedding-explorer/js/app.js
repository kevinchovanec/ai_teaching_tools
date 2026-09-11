import * as glove from "./glove.js";
import * as sentence from "./sentence.js";
import { pca2D } from "./pca.js";
import { drawVectorBarChart, drawScatterChart } from "./charts.js";

// ---------- Tabs ----------

const tabButtons = document.querySelectorAll("nav.tabs button");
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    document.querySelectorAll("section.panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- GloVe status / boot ----------

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
let gloveReady = false;

glove
  .loadGlove((msg) => { statusText.textContent = msg; })
  .then(() => {
    gloveReady = true;
    statusDot.classList.remove("loading");
    statusDot.classList.add("ready");
    statusText.textContent = `Word vectors ready — ${glove.vocabSize().toLocaleString()} words`;
  })
  .catch((err) => {
    statusDot.classList.remove("loading");
    statusText.textContent = `Couldn't load word vectors: ${err.message}`;
  });

function requireGlove() {
  if (!gloveReady) throw new Error("Word vectors are still loading — try again in a moment.");
}

// ---------- Word Vectors panel ----------

const wordInput = document.getElementById("word-input");
const wordError = document.getElementById("word-error");
const wordResults = document.getElementById("word-results");
const wordChart = document.getElementById("word-chart");
const wordRaw = document.getElementById("word-raw");
const wordNeighborsCard = document.getElementById("word-neighbors-card");
const wordNeighborsList = document.getElementById("word-neighbors");

function renderNeighborList(container, neighbors) {
  container.innerHTML = "";
  const maxSim = Math.max(...neighbors.map((n) => n.similarity), 1e-6);
  for (const { word, similarity } of neighbors) {
    const li = document.createElement("li");
    const pct = Math.max(0, similarity / maxSim) * 100;
    li.innerHTML = `
      <span class="word">${word}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
      <span class="score">${similarity.toFixed(3)}</span>
    `;
    container.appendChild(li);
  }
}

function doWordLookup() {
  const word = wordInput.value.trim();
  wordError.hidden = true;
  if (!word) {
    wordResults.hidden = true;
    wordNeighborsCard.hidden = true;
    return;
  }
  try {
    requireGlove();
    if (!glove.hasWord(word)) {
      wordResults.hidden = true;
      wordNeighborsCard.hidden = true;
      wordError.hidden = false;
      wordError.textContent = `"${word}" isn't in the top 15,000 English words this demo uses. Try a more common word.`;
      return;
    }
    const vec = glove.getVector(word);
    drawVectorBarChart(wordChart, Array.from(vec.slice(0, 24)));
    wordRaw.textContent = Array.from(vec).map((v) => v.toFixed(3)).join(", ");
    wordResults.hidden = false;

    const neighbors = glove.nearest(vec, 8, [word]);
    renderNeighborList(wordNeighborsList, neighbors);
    wordNeighborsCard.hidden = false;
  } catch (err) {
    wordResults.hidden = true;
    wordNeighborsCard.hidden = true;
    wordError.hidden = false;
    wordError.textContent = err.message;
  }
}

let wordDebounce;
wordInput.addEventListener("input", () => {
  clearTimeout(wordDebounce);
  wordDebounce = setTimeout(doWordLookup, 250);
});
wordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { clearTimeout(wordDebounce); doWordLookup(); }
});

// ---------- Analogies panel ----------

const analogyA = document.getElementById("analogy-a");
const analogyB = document.getElementById("analogy-b");
const analogyC = document.getElementById("analogy-c");
const analogyRun = document.getElementById("analogy-run");
const analogyError = document.getElementById("analogy-error");
const analogyResults = document.getElementById("analogy-results");
const analogyNeighbors = document.getElementById("analogy-neighbors");

function runAnalogy() {
  analogyError.hidden = true;
  analogyResults.hidden = true;
  const a = analogyA.value.trim();
  const b = analogyB.value.trim();
  const c = analogyC.value.trim();
  if (!a || !b || !c) {
    analogyError.hidden = false;
    analogyError.textContent = "Fill in all three words.";
    return;
  }
  try {
    requireGlove();
    const missing = [a, b, c].filter((w) => !glove.hasWord(w));
    if (missing.length) {
      analogyError.hidden = false;
      analogyError.textContent = `Not in vocabulary: ${missing.join(", ")}`;
      return;
    }
    const va = glove.getVector(a);
    const vb = glove.getVector(b);
    const vc = glove.getVector(c);
    const query = glove.addVec(glove.subVec(va, vb), vc);
    const neighbors = glove.nearest(query, 5, [a, b, c]);
    renderNeighborList(analogyNeighbors, neighbors);
    analogyResults.hidden = false;
  } catch (err) {
    analogyError.hidden = false;
    analogyError.textContent = err.message;
  }
}

analogyRun.addEventListener("click", runAnalogy);
[analogyA, analogyB, analogyC].forEach((inp) => {
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") runAnalogy(); });
});

const PRESETS = [
  { a: "king", b: "man", c: "woman" },
  { a: "paris", b: "france", c: "italy" },
  { a: "bigger", b: "big", c: "small" },
  { a: "worse", b: "bad", c: "good" },
];
const presetsContainer = document.getElementById("analogy-presets");
for (const p of PRESETS) {
  const btn = document.createElement("button");
  btn.className = "ghost";
  btn.textContent = `${p.a} − ${p.b} + ${p.c}`;
  btn.addEventListener("click", () => {
    analogyA.value = p.a; analogyB.value = p.b; analogyC.value = p.c;
    runAnalogy();
  });
  presetsContainer.appendChild(btn);
}

// ---------- Similarity panel ----------

const simA = document.getElementById("sim-a");
const simB = document.getElementById("sim-b");
const simRun = document.getElementById("sim-run");
const simError = document.getElementById("sim-error");
const simResults = document.getElementById("sim-results");
const simValue = document.getElementById("sim-value");
const simFill = document.getElementById("sim-fill");
const simMethod = document.getElementById("sim-method");

function isSingleWord(text) {
  return text.trim().length > 0 && !/\s/.test(text.trim());
}

async function runSimilarity() {
  simError.hidden = true;
  simResults.hidden = true;
  const a = simA.value.trim();
  const b = simB.value.trim();
  if (!a || !b) {
    simError.hidden = false;
    simError.textContent = "Fill in both text boxes.";
    return;
  }

  simRun.disabled = true;
  simRun.textContent = "Comparing…";
  try {
    let sim, method;
    if (isSingleWord(a) && isSingleWord(b) && gloveReady && glove.hasWord(a) && glove.hasWord(b)) {
      sim = glove.cosineSim(glove.getVector(a), glove.getVector(b));
      method = "Compared directly using GloVe word vectors.";
    } else {
      const [va, vb] = await sentence.embedBatch([a, b], (p) => {
        if (p.status === "progress") {
          simRun.textContent = `Loading model… ${Math.round(p.progress || 0)}%`;
        }
      });
      sim = sentence.cosineSim(va, vb);
      method = "Compared using a transformer sentence embedding (all-MiniLM-L6-v2).";
    }
    simValue.textContent = sim.toFixed(3);
    simFill.style.width = `${Math.max(0, Math.min(1, (sim + 1) / 2)) * 100}%`;
    simMethod.textContent = method;
    simResults.hidden = false;
  } catch (err) {
    simError.hidden = false;
    simError.textContent = err.message;
  } finally {
    simRun.disabled = false;
    simRun.textContent = "Compare";
  }
}

simRun.addEventListener("click", runSimilarity);

// ---------- Paragraph Space panel ----------

const spaceItems = document.getElementById("space-items");
const spaceAdd = document.getElementById("space-add");
const spaceRun = document.getElementById("space-run");
const spaceError = document.getElementById("space-error");
const spaceResults = document.getElementById("space-results");
const spaceChart = document.getElementById("space-chart");
const spaceTable = document.getElementById("space-table");

const DEFAULT_ITEMS = [
  "a happy dog running in a field",
  "a joyful puppy sprinting through grass",
  "the stock market fell sharply today",
  "quarterly earnings dropped due to inflation",
];

function addItemRow(value = "") {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input type="text" value="${value.replace(/"/g, "&quot;")}" placeholder="type a word or paragraph" />
    <button type="button" class="remove" title="Remove">×</button>
  `;
  row.querySelector(".remove").addEventListener("click", () => row.remove());
  spaceItems.appendChild(row);
}

DEFAULT_ITEMS.forEach((t) => addItemRow(t));
spaceAdd.addEventListener("click", () => addItemRow());

function truncateLabel(text, n = 28) {
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}

async function runSpace() {
  spaceError.hidden = true;
  spaceResults.hidden = true;
  const texts = Array.from(spaceItems.querySelectorAll("input"))
    .map((i) => i.value.trim())
    .filter(Boolean);

  if (texts.length < 2) {
    spaceError.hidden = false;
    spaceError.textContent = "Add at least two items to compare.";
    return;
  }

  spaceRun.disabled = true;
  spaceRun.textContent = "Embedding…";
  try {
    const vectors = await sentence.embedBatch(texts, (p) => {
      if (p.status === "progress") {
        spaceRun.textContent = `Loading model… ${Math.round(p.progress || 0)}%`;
      } else {
        spaceRun.textContent = "Embedding…";
      }
    });

    const points2D = pca2D(vectors);
    drawScatterChart(
      spaceChart,
      points2D.map(([x, y], i) => ({ x, y, label: truncateLabel(texts[i]), fullLabel: texts[i] }))
    );

    let html = "<tr><th></th>" + texts.map((t) => `<th>${truncateLabel(t, 14)}</th>`).join("") + "</tr>";
    for (let i = 0; i < texts.length; i++) {
      html += `<tr><th>${truncateLabel(texts[i], 14)}</th>`;
      for (let j = 0; j < texts.length; j++) {
        const s = i === j ? 1 : sentence.cosineSim(vectors[i], vectors[j]);
        html += `<td>${s.toFixed(2)}</td>`;
      }
      html += "</tr>";
    }
    spaceTable.innerHTML = html;
    spaceResults.hidden = false;
  } catch (err) {
    spaceError.hidden = false;
    spaceError.textContent = err.message;
  } finally {
    spaceRun.disabled = false;
    spaceRun.textContent = "Plot";
  }
}

spaceRun.addEventListener("click", runSpace);
