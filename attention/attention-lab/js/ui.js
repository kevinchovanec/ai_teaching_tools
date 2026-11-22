export const $ = (id) => document.getElementById(id);

export const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function fmt(value, digits = 2) {
  if (value === -Infinity) return "−∞";
  const text = value.toFixed(digits);
  return Number(text) === 0 ? (0).toFixed(digits) : text.replace("-", "−");
}

export const options = (items, selected = 0) =>
  items.map((item, i) => `<option value="${i}"${i === selected ? " selected" : ""}>${esc(item)}</option>`).join("");

/** An HTML heatmap. With `pick`, each cell is a button. */
export function heatmap(matrix, { rows, cols, pick, selected, digits = 2, label = "cell" } = {}) {
  const max = Math.max(1e-9, ...matrix.flatMap((row) => Array.from(row)).filter(Number.isFinite).map(Math.abs));
  const head = cols ? `<thead><tr><th></th>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>` : "";
  const body = matrix.map((row, i) => {
    const cells = Array.from(row, (v, j) => {
      const shade = Number.isFinite(v) ? (Math.abs(v) / max) * 55 : 0;
      const style = `--p:${shade}%;--tone:var(--diverge-${v < 0 ? "neg" : "pos"})`;
      const text = fmt(v, digits);
      const inner = pick
        ? `<button style="${style}" data-pick="${pick}" data-i="${i}" data-j="${j}"
            aria-label="${esc(label)} row ${i + 1}, column ${j + 1}: ${text}"
            aria-pressed="${selected?.[0] === i && selected?.[1] === j}">${text}</button>`
        : `<span style="${style}">${text}</span>`;
      return `<td class="cell">${inner}</td>`;
    });
    return `<tr>${rows ? `<th scope="row">${esc(rows[i])}</th>` : ""}${cells.join("")}</tr>`;
  });
  return `<div class="scroll"><table>${head}<tbody>${body.join("")}</tbody></table></div>`;
}

/** Calls handler(name, i, j) for heatmap clicks, keeping keyboard focus across re-renders. */
export function onPick(container, handler) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pick]");
    if (!button) return;
    const { pick, i, j } = button.dataset;
    handler(pick, Number(i), Number(j));
    container.querySelector(`[data-pick="${pick}"][data-i="${i}"][data-j="${j}"]`)?.focus();
  });
}

export function editor(container, name, matrix, rows, onChange) {
  container.innerHTML = `<h3>${name}</h3><div class="scroll"><table>${matrix.map((row, i) =>
    `<tr><th scope="row">${esc(rows?.[i] ?? i + 1)}</th>${row.map((v, j) =>
      `<td><input type="number" step="0.5" min="-100" max="100" value="${v}" data-i="${i}" data-j="${j}"
        aria-label="${name} row ${i + 1}, column ${j + 1}"></td>`).join("")}</tr>`).join("")}</table></div>`;
  container.oninput = ({ target }) => {
    const value = target.valueAsNumber;
    if (!Number.isFinite(value) || Math.abs(value) > 100) return;
    matrix[target.dataset.i][target.dataset.j] = value;
    onChange();
  };
}
