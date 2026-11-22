import { initByHand } from "./by-hand.js";
import { initScaling } from "./scaling.js";
import { initMasking } from "./masking.js";
import { loadData } from "./gpt2-data.js";
import { initGpt2 } from "./gpt2.js";
import { initShuffle, initSymmetry, initAblation } from "./experiments.js";
import { $ } from "./ui.js";

// Each tab has its own URL (#masking, for example) so instructors can link straight to it.
const tabs = [...document.querySelectorAll('[role="tab"]')];

function showTab() {
  const current = tabs.find((tab) => `#${tab.dataset.tab}` === location.hash) ?? tabs[0];
  for (const tab of tabs) {
    tab.setAttribute("aria-selected", tab === current);
    tab.tabIndex = tab === current ? 0 : -1;
    $(`panel-${tab.dataset.tab}`).hidden = tab !== current;
  }
}

tabs.forEach((tab, i) => {
  const select = (next) => {
    history.replaceState(null, "", `#${next.dataset.tab}`);
    showTab();
  };
  tab.onclick = () => select(tab);
  tab.onkeydown = (event) => {
    const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!move) return;
    const next = tabs[(i + move + tabs.length) % tabs.length];
    select(next);
    next.focus();
  };
});
window.addEventListener("hashchange", showTab);
showTab();

initByHand();
initScaling();
initMasking();
initShuffle();

try {
  const data = await loadData();
  initGpt2(data);
  initSymmetry(data);
  initAblation(data);
  $("gpt2-content").hidden = false;
  $("gpt2-experiments").hidden = false;
  for (const status of document.querySelectorAll(".data-status")) status.hidden = true;
} catch (error) {
  for (const status of document.querySelectorAll(".data-status")) {
    status.textContent = `Couldn’t load the GPT-2 data (${error.message}). Reload to try again.`;
  }
}
