// Small dependency-free SVG chart helpers: a diverging bar chart for a single
// embedding vector, and a labeled 2D scatter plot for a PCA projection.

const SVG_NS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function getTooltip() {
  return document.getElementById("tooltip");
}

function showTooltip(evt, html) {
  const tip = getTooltip();
  tip.innerHTML = html;
  tip.style.left = `${evt.clientX}px`;
  tip.style.top = `${evt.clientY}px`;
  tip.hidden = false;
}

function moveTooltip(evt) {
  const tip = getTooltip();
  tip.style.left = `${evt.clientX}px`;
  tip.style.top = `${evt.clientY}px`;
}

function hideTooltip() {
  getTooltip().hidden = true;
}

/** A path for a bar growing from a baseline, rounded only at the far (data) end. */
function roundedBarPath(x, width, baselineY, height, direction, radius) {
  const r = Math.min(radius, height / 2, width / 2);
  if (height <= 0) return "";
  if (direction === "up") {
    const top = baselineY - height;
    return `M${x},${baselineY} L${x},${top + r} Q${x},${top} ${x + r},${top} ` +
      `L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} ` +
      `L${x + width},${baselineY} Z`;
  }
  const bottom = baselineY + height;
  return `M${x},${baselineY} L${x},${bottom - r} Q${x},${bottom} ${x + r},${bottom} ` +
    `L${x + width - r},${bottom} Q${x + width},${bottom} ${x + width},${bottom - r} ` +
    `L${x + width},${baselineY} Z`;
}

/**
 * Draws a diverging bar chart of `values` (signed numbers) into `svg`.
 * Positive bars grow up in the "positive" color, negative bars grow down in the "negative" color.
 */
export function drawVectorBarChart(svg, values, { positiveVar = "--diverge-pos", negativeVar = "--diverge-neg" } = {}) {
  svg.innerHTML = "";
  const vb = svg.viewBox.baseVal;
  const W = vb.width || 640;
  const H = vb.height || 160;
  const padX = 6;
  const baselineY = H / 2;
  const halfSpan = H / 2 - 14;

  const maxAbs = Math.max(1e-6, ...values.map((v) => Math.abs(v)));
  const n = values.length;
  const plotW = W - padX * 2;
  const slot = plotW / n;
  const barWidth = Math.min(24, Math.max(2, slot - 2));

  const style = getComputedStyle(document.documentElement);
  const posColor = style.getPropertyValue(positiveVar).trim();
  const negColor = style.getPropertyValue(negativeVar).trim();

  svg.appendChild(el("line", {
    x1: padX, x2: W - padX, y1: baselineY, y2: baselineY,
    stroke: style.getPropertyValue("--baseline").trim(), "stroke-width": 1,
  }));

  values.forEach((v, i) => {
    const x = padX + i * slot + (slot - barWidth) / 2;
    const h = (Math.abs(v) / maxAbs) * halfSpan;
    const dir = v >= 0 ? "up" : "down";
    const d = roundedBarPath(x, barWidth, baselineY, h, dir, 4);
    if (!d) return;
    const path = el("path", { d, fill: v >= 0 ? posColor : negColor });
    path.style.cursor = "default";
    path.addEventListener("mouseenter", (e) => showTooltip(e, `dim ${i}: <strong>${v.toFixed(4)}</strong>`));
    path.addEventListener("mousemove", moveTooltip);
    path.addEventListener("mouseleave", hideTooltip);
    svg.appendChild(path);
  });
}

/**
 * Draws a labeled 2D scatter plot into `svg`.
 * `points` is an array of { x, y, label } in data space (arbitrary units, e.g. PCA scores).
 */
export function drawScatterChart(svg, points) {
  svg.innerHTML = "";
  const vb = svg.viewBox.baseVal;
  const W = vb.width || 640;
  const H = vb.height || 480;
  const pad = 48;

  const style = getComputedStyle(document.documentElement);
  const seriesColor = style.getPropertyValue("--series-1").trim();
  const surfaceColor = style.getPropertyValue("--surface-1").trim();
  const gridColor = style.getPropertyValue("--gridline").trim();
  const textColor = style.getPropertyValue("--text-secondary").trim();

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minX === maxX) { minX -= 1; maxX += 1; }
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const spanX = maxX - minX, spanY = maxY - minY;
  minX -= spanX * 0.12; maxX += spanX * 0.12;
  minY -= spanY * 0.12; maxY += spanY * 0.12;

  const sx = (x) => pad + ((x - minX) / (maxX - minX)) * (W - pad * 2);
  const sy = (y) => H - pad - ((y - minY) / (maxY - minY)) * (H - pad * 2);

  // gridlines at the axes' zero-crossing (arbitrary PCA units, just an origin reference)
  if (minX < 0 && maxX > 0) {
    svg.appendChild(el("line", { x1: sx(0), x2: sx(0), y1: pad, y2: H - pad, stroke: gridColor, "stroke-width": 1 }));
  }
  if (minY < 0 && maxY > 0) {
    svg.appendChild(el("line", { x1: pad, x2: W - pad, y1: sy(0), y2: sy(0), stroke: gridColor, "stroke-width": 1 }));
  }

  points.forEach((p) => {
    const cx = sx(p.x), cy = sy(p.y);
    const dot = el("circle", {
      cx, cy, r: 5.5, fill: seriesColor, stroke: surfaceColor, "stroke-width": 2,
    });
    dot.style.cursor = "default";
    dot.addEventListener("mouseenter", (e) => showTooltip(e, `${escapeHtml(p.fullLabel ?? p.label)}`));
    dot.addEventListener("mousemove", moveTooltip);
    dot.addEventListener("mouseleave", hideTooltip);
    svg.appendChild(dot);

    const label = el("text", {
      x: cx + 10, y: cy + 4, "font-size": 11, fill: textColor,
    });
    label.textContent = p.label;
    svg.appendChild(label);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
