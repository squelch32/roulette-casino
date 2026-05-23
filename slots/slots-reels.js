/**
 * Reels — square cells with one symbol PNG each.
 * Viewport shows: half a cell (top peek), one full cell (middle), half a cell (bottom peek).
 */

import { SYMBOL_IDS } from "./slots-config.js";

const SYMBOL_DIR = "symbols";

const SPIN_SYMBOLS = 16;
const SPIN_MS = 2200;
const REEL_STAGGER_MS = 400;
const LEVER_PULL_MS = 420;

const MULT_HUES = {
  mult2: 210,
  mult3: 120,
  mult5: 52,
  mult10: 28,
  mult25: 300,
  mult50: 280,
};

/**
 * @param {HTMLElement} cabinet
 * @param {{ onSpinEnd: (result: string) => void }} hooks
 */
export function mountReels(cabinet, hooks) {
  const windowEl = cabinet.querySelector("#reels-window");
  if (!windowEl) return { updateSettings() {}, spin() {}, isSpinning: () => false };

  const reels = [...windowEl.querySelectorAll(".reel")].map((reel) => ({
    reel,
    strip: /** @type {HTMLElement} */ (reel.querySelector(".reel-strip")),
  }));

  let spinning = false;

  const state = {
    symbols: /** @type {Record<string, boolean>} */ ({}),
    payouts: /** @type {import("./slots-config.js").PayoutRule[]} */ ([]),
    bet: 1,
  };

  function getEnabledPool() {
    const pool = SYMBOL_IDS.filter((id) => state.symbols[id] !== false);
    return pool.length ? pool : ["seven"];
  }

  function pickSymbol() {
    const pool = getEnabledPool();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * @param {HTMLElement} stripEl
   * @param {string} top
   * @param {string} mid
   * @param {string} bot
   */
  function renderStrip(stripEl, top, mid, bot) {
    stripEl.replaceChildren();
    const sequence = [];
    for (let i = 0; i < SPIN_SYMBOLS; i += 1) {
      sequence.push(pickSymbol());
    }
    sequence.push(top, mid, bot);

    const cellCount = sequence.length;
    stripEl.style.setProperty("--cell-count", String(cellCount));

    sequence.forEach((id) => {
      stripEl.append(createSymbolCell(id));
    });

    stripEl.style.transition = "none";
    stripEl.style.transform = `translateY(${restingY(cellCount)}%)`;
  }

  function setInitial() {
    reels.forEach((r) => {
      renderStrip(r.strip, "seven", "seven", "seven");
    });
  }

  function updateSettings({ symbols, payouts, bet }) {
    if (symbols) state.symbols = symbols;
    if (payouts) state.payouts = payouts;
    if (bet != null) state.bet = bet;
  }

  /**
   * @param {HTMLElement} leverWrap
   */
  async function spin(leverWrap) {
    if (spinning) return;
    spinning = true;
    cabinet.classList.add("machine-cabinet--spinning");
    windowEl.classList.add("reels-window--spinning");

    const finalCols = [0, 1, 2].map(() => {
      const top = pickSymbol();
      const mid = pickSymbol();
      const bot = pickSymbol();
      return [top, mid, bot];
    });

    const spinPromises = reels.map((r, col) => {
      const [top, mid, bot] = finalCols[col];
      return new Promise((resolve) => {
        renderStrip(r.strip, top, mid, bot);
        const cellCount = SPIN_SYMBOLS + 3;
        const cellPct = 100 / cellCount;
        const endY = restingY(cellCount);
        const startY = -0.5 * cellPct;

        r.strip.style.transition = "none";
        r.strip.style.transform = `translateY(${startY}%)`;

        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            const duration = SPIN_MS + col * REEL_STAGGER_MS;
            r.strip.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.7, 0.1, 1)`;
            r.strip.style.transform = `translateY(${endY}%)`;
          });
        });

        window.setTimeout(resolve, SPIN_MS + col * REEL_STAGGER_MS + 50);
      });
    });

    leverWrap.classList.add("lever-wrap--pulling");
    await wait(LEVER_PULL_MS);
    leverWrap.classList.remove("lever-wrap--pulling");
    leverWrap.classList.add("lever-wrap--released");
    window.setTimeout(() => leverWrap.classList.remove("lever-wrap--released"), 280);

    await Promise.all(spinPromises);

    windowEl.classList.remove("reels-window--spinning");
    cabinet.classList.remove("machine-cabinet--spinning");

    const middle = finalCols.map((col) => col[1]);
    const message = evaluateMiddleRow(middle, state.payouts, state.bet);
    spinning = false;
    hooks.onSpinEnd(message);
  }

  setInitial();

  return {
    updateSettings,
    spin,
    isSpinning: () => spinning,
  };
}

/**
 * Resting Y (in % of strip height) that places the last three cells as
 * [top peek, full middle, bottom peek].
 * @param {number} cellCount
 */
function restingY(cellCount) {
  const cellPct = 100 / cellCount;
  const topIndex = cellCount - 3;
  return -(topIndex + 0.5) * cellPct;
}

/** @param {string} id */
function createSymbolCell(id) {
  const cell = document.createElement("div");
  cell.className = "reel-cell";

  if (id.startsWith("mult")) {
    const amount = Number(id.replace("mult", "")) || 2;
    const tile = document.createElement("span");
    tile.className = "reel-mult";
    tile.style.background = `hsl(${MULT_HUES[id] ?? 210} 75% 42%)`;
    tile.textContent = `×${amount}`;
    cell.append(tile);
    return cell;
  }

  const img = document.createElement("img");
  img.className = "reel-symbol";
  img.src = `${SYMBOL_DIR}/${id}.png`;
  img.alt = "";
  img.draggable = false;
  cell.append(img);
  return cell;
}

/**
 * @param {string[]} middle
 * @param {import("./slots-config.js").PayoutRule[]} payouts
 * @param {number} bet
 */
export function evaluateMiddleRow(middle, payouts, bet) {
  if (middle.every((s) => s.startsWith("mult"))) {
    return "Three multipliers — no change to money (board-game signal).";
  }

  const enabled = payouts.filter((p) => p.enabled !== false);
  /** @type {{ rule: import("./slots-config.js").PayoutRule, score: number }[]} */
  const hits = [];

  for (const rule of enabled) {
    if (rule.match === "none") continue;
    if (rule.type === "signal") continue;
    if (!matchesRule(middle, rule)) continue;
    hits.push({ rule, score: payoutScore(rule, bet) });
  }

  if (!hits.length) {
    const none = enabled.find((p) => p.match === "none");
    if (none && none.type === "money") return "No win — none of a kind.";
    return "No win this spin.";
  }

  hits.sort((a, b) => b.score - a.score);
  return describeWin(hits[0].rule, bet);
}

/**
 * @param {string[]} middle
 * @param {import("./slots-config.js").PayoutRule} rule
 */
function matchesRule(middle, rule) {
  if (rule.match === "triple" && rule.symbol) {
    return middle.every((s) => s === rule.symbol);
  }
  if (rule.match === "count" && rule.symbol && rule.count != null) {
    const n = middle.filter((s) => s === rule.symbol).length;
    return n === rule.count;
  }
  return false;
}

/** @param {import("./slots-config.js").PayoutRule} rule @param {number} bet */
function payoutScore(rule, bet) {
  if (rule.type === "times") return rule.amount * bet;
  if (rule.type === "take") return -rule.amount;
  return rule.amount;
}

/** @param {import("./slots-config.js").PayoutRule} rule @param {number} bet */
function describeWin(rule, bet) {
  if (rule.type === "times") {
    const total = rule.amount * bet;
    return `Win — ${rule.label}: ×${rule.amount} bet = $${total}.`;
  }
  if (rule.type === "take") {
    return `Take away — ${rule.label}: −$${rule.amount}.`;
  }
  return `Win — ${rule.label}: $${rule.amount}.`;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
