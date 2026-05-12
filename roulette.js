/* European roulette — practice-at-home piles (no gifted demo credits). */

const DENOMS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000];

const CHIP_SHEET_FILE = "rb_chips.png";
const CHIP_SPRITES = {
  1: { row: 0, col: 0 },
  2: { row: 0, col: 1 },
  5: { row: 0, col: 2 },
  10: { row: 0, col: 3 },
  25: { row: 0, col: 4 },
  50: { row: 0, col: 5 },
  100: { row: 0, col: 6 },
  250: { row: 1, col: 0 },
  500: { row: 1, col: 1 },
  1000: { row: 1, col: 2 },
  2000: { row: 1, col: 3 },
  5000: { row: 1, col: 4 },
};

const MIN_BET = 1;
const MAX_BET = 99_999_999;

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const WHEEL_SEQUENCE = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1,
  20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const AMERICAN_WHEEL_SEQUENCE = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 27, "00", 10, 25, 29, 12,
  8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2, 1,
];

const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const chipArtByValue = new Map();
const chipValueByBetKey = new Map();

/** Roulette face raster — sits beside index.html when you test with HTTP (see dev-server.mjs). */
const WHEEL_PDF_FILE = "my own casino.pdf";
/** Bump this if your wheel illustration is not the first PDF page */
const WHEEL_PDF_PAGE = 1;
/**
 * Crop from one PDF page: `{ left, top, width, height }` uses fractions between 0 and 1 relative to page size.
 * The PDF contains two wheels: the left is single-zero roulette, the right includes 00.
 */
const WHEEL_PDF_CLIPS = {
  european: { left: 0.037, top: 0.086, width: 0.464, height: 0.826 },
  american: { left: 0.536, top: 0.091, width: 0.449, height: 0.821 },
};

const els = {};

let currentCurrencySymbol = "$";
let rouletteType = "european";
let roundSum = 0;
let totalWins = 0;
let totalLosses = 0;
let totalEarnings = 0;
let toastTimer = 0;
let settling = false;
let settleTimer = 0;

/** @typedef {{ numbers: Array<number | string>, stake: number, payout: number, label: string }} InsideBet */
/** @typedef {{ straight: Map<number | string, number>, inside: Map<string, InsideBet>, low: number, high: number, red: number, black: number, odd: number, even: number, column: Record<1 | 2 | 3, number>, dozen: Record<1 | 2 | 3, number> }} Cloth */
/** @type {Cloth} */
const cloth = {
  straight: new Map(),
  inside: new Map(),
  low: 0,
  high: 0,
  red: 0,
  black: 0,
  odd: 0,
  even: 0,
  column: { 1: 0, 2: 0, 3: 0 },
  dozen: { 1: 0, 2: 0, 3: 0 },
};

let spinning = false;

/** Tracks cumulative clockwise rotation chosen for smooth CSS easing */
let cumulativeRotationDeg = 0;

document.addEventListener("DOMContentLoaded", () => {
  cacheRefs();
  appendToastIfNeeded();
  buildChipTray();
  void applyChipSheetArtwork();
  buildNumberGrid();
  wireUi();
  renderAll();
  void paintWheelSkin();
});

function cacheRefs() {
  els.betAmt = document.getElementById("bet-amount-input");
  els.chipTray = document.getElementById("chip-rack");
  els.grid = document.getElementById("table-grid");
  els.wheel = document.getElementById("wheel");
  els.result = document.getElementById("last-result");
  els.betList = document.getElementById("bet-list");
  els.spinBtn = document.getElementById("btn-spin");
  els.deleteBetsBtn = document.getElementById("btn-delete-bets");
  els.restartSessionBtn = document.getElementById("btn-restart-session");
  els.howBtn = document.getElementById("btn-how");
  els.how = document.getElementById("how-dialog");
  els.currencyButtons = [...document.querySelectorAll("[data-currency-symbol]")];
  els.typeButtons = [...document.querySelectorAll("[data-roulette-type]")];
  els.summaryWin = document.getElementById("summary-win");
  els.summaryLoss = document.getElementById("summary-loss");
  els.summarySum = document.getElementById("summary-sum");
  els.summaryBet = document.getElementById("summary-bet");
  els.summaryTotal = document.getElementById("summary-total");
}

function appendToastIfNeeded() {
  if (document.getElementById("toast")) return;
  const host = document.createElement("aside");
  host.className = "toast-host";

  const p = document.createElement("p");
  p.id = "toast";
  p.role = "status";
  p.setAttribute("aria-live", "polite");
  host.appendChild(p);

  document.body.appendChild(host);
  els.toast = p;
}

function toast(msg) {
  if (!els.toast) appendToastIfNeeded();
  els.toast.textContent = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.textContent = "";
  }, 3500);
}

function wireUi() {
  document.getElementById("btn-spin").addEventListener("click", handleSpin);
  els.deleteBetsBtn.addEventListener("click", deleteAllBets);
  els.restartSessionBtn.addEventListener("click", restartSession);

  els.howBtn.addEventListener("click", () => {
    if (typeof els.how.showModal === "function") els.how.showModal();
  });

  document.querySelectorAll("[data-bet-kind]").forEach((node) =>
    {
      const arg = node.dataset.arg != null ? Number(node.dataset.arg) : undefined;
      node.dataset.betKey = betKey(node.dataset.betKind, arg);
      node.addEventListener("click", () => layOutsideBet(node.dataset.betKind, arg));
      node.addEventListener("mouseenter", () => highlightOutsideBet(node.dataset.betKind, arg));
      node.addEventListener("mouseleave", clearColumnRowHighlight);
      node.addEventListener("focus", () => highlightOutsideBet(node.dataset.betKind, arg));
      node.addEventListener("blur", clearColumnRowHighlight);
    },
  );

  els.currencyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentCurrencySymbol = btn.dataset.currencySymbol || "$";
      renderAll();
    });
  });

  els.typeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextType = btn.dataset.rouletteType || "european";
      if (nextType === rouletteType) return;

      rouletteType = nextType;
      if (cloth.straight.has("00")) {
        cloth.straight.delete("00");
      }
      buildNumberGrid();
      renderAll();
      void paintWheelSkin();
      toast(
        rouletteType === "american"
          ? "American roulette selected — double zero is now in play."
          : "European roulette selected — single zero only.",
      );
    });
  });

  els.betAmt.addEventListener("change", clampBetAmountField);
}

function summaryMoney(amount) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currentCurrencySymbol}${fmt.format(Math.abs(amount))}`;
}

function signedSummaryMoney(amount) {
  if (amount === 0) return summaryMoney(0);
  const sign = amount > 0 ? "+" : "-";
  return `${sign}${currentCurrencySymbol}${fmt.format(Math.abs(amount))}`;
}

function clampBetAmountField() {
  const v = parseIntegerFieldValue(els.betAmt.value);
  const safe = Number.isFinite(v)
    ? Math.min(MAX_BET, Math.max(MIN_BET, v))
    : MIN_BET;
  els.betAmt.value = String(safe);
}

function numberLabelPlain(n) {
  if (n === "00") return "00 • green pocket";
  if (!Number.isFinite(n)) return "waiting";
  if (n === 0) return "0 • green pocket";
  return `${n} • ${RED_NUMBERS.has(n) ? "red" : "black"}`;
}

function stripeForNumber(num) {
  if (num === 0 || num === "00") return "#1e6b43";
  return RED_NUMBERS.has(num) ? "#c62828" : "#0e1014";
}

function clampUnit(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/**
 * Draws the roulette face so the wheel numbers use Helvetica Neue Bold.
 * The PDF artwork is not used here because its text is baked into the image.
 */
async function paintWheelSkin() {
  await loadWheelFont();
  paintWheelFallback();
}

async function loadWheelFont() {
  if (!document.fonts?.load) return;

  await document.fonts.load('700 21px "Helvetica Neue Bold"');
  await document.fonts.ready;
}

/**
 * @returns {Promise<boolean>}
 */
async function renderWheelFaceFromPdf() {
  if (typeof pdfjsLib === "undefined" || typeof pdfjsLib.getDocument !== "function") return false;

  const url = new URL(WHEEL_PDF_FILE, window.location.href).href;
  const pdf = await pdfjsLib.getDocument({ url }).promise;
  const page = await pdf.getPage(WHEEL_PDF_PAGE);

  const baseViewport = page.getViewport({ scale: 1 });
  const wheelEl = els.wheel;
  const approxSide = Math.max(wheelEl.clientWidth || wheelEl.offsetWidth || 280, 200);
  const dprCap = Math.min(window.devicePixelRatio || 1, 2);
  /** Extra factor keeps labels sharp behind the curved border */
  const scale = ((approxSide * dprCap * 3) / Math.max(baseViewport.width, baseViewport.height));

  const viewport = page.getViewport({ scale });

  const vw = viewport.width;
  const vh = viewport.height;

  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;

  const clip = WHEEL_PDF_CLIPS[rouletteType];
  if (clip) {
    const c = clip;
    const left = clampUnit(c.left ?? 0);
    const top = clampUnit(c.top ?? 0);
    let width = c.width ?? 1;
    let height = c.height ?? 1;
    if (!Number.isFinite(width) || width <= 0) width = 1;
    if (!Number.isFinite(height) || height <= 0) height = 1;
    sx = left * vw;
    sy = top * vh;
    sw = Math.min(width * vw, vw - sx);
    sh = Math.min(height * vh, vh - sy);
  }

  const scratch = document.createElement("canvas");
  scratch.width = Math.max(2, Math.ceil(vw));
  scratch.height = Math.max(2, Math.ceil(vh));
  await page.render({ canvasContext: scratch.getContext("2d"), viewport }).promise;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = Math.max(2, Math.round(sw));
  outCanvas.height = Math.max(2, Math.round(sh));
  const octx = outCanvas.getContext("2d");

  try {
    octx.drawImage(scratch, sx, sy, sw, sh, 0, 0, outCanvas.width, outCanvas.height);
  } catch {
    /** @internal */
    scratch.remove();
    return false;
  }
  scratch.remove();

  wheelEl.replaceChildren();
  outCanvas.className = "wheel-canvas";
  wheelEl.appendChild(outCanvas);

  wheelEl.style.backgroundImage = "none";

  cumulativeRotationDeg = 2;
  wheelEl.style.transform = `rotate(${cumulativeRotationDeg}deg)`;
  return true;
}

/** Draws the wheel face with editable canvas text */
function paintWheelFallback() {
  const wheelEl = els.wheel;
  const sequence = currentWheelSequence();
  const step = wheelStepDeg();
  const side = Math.max(wheelEl.clientWidth || wheelEl.offsetWidth || 280, 200);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.className = "wheel-canvas";
  canvas.width = Math.round(side * dpr);
  canvas.height = Math.round(side * dpr);

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const cx = side / 2;
  const cy = side / 2;
  const outerR = side * 0.485;
  const innerR = side * 0.315;
  const labelR = (outerR + innerR) / 2;

  ctx.clearRect(0, 0, side, side);

  sequence.forEach((value, i) => {
    const start = degreesToRadians(-90 + i * step);
    const end = degreesToRadians(-90 + (i + 1) * step);

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, start, end);
    ctx.arc(cx, cy, innerR, end, start, true);
    ctx.closePath();
    ctx.fillStyle = stripeForNumber(value);
    ctx.fill();
    ctx.strokeStyle = "#f7f7f7";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const mid = start + (end - start) / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * labelR, cy + Math.sin(mid) * labelR);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 21px "Helvetica Neue Bold", "Helvetica Neue", Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), 0, 0);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 1, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  wheelEl.replaceChildren(canvas);
  wheelEl.style.backgroundImage = "none";
  wheelEl.style.backgroundClip = "padding-box";

  cumulativeRotationDeg = 2;
  wheelEl.style.transform = `rotate(${cumulativeRotationDeg}deg)`;
}

function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

function currentWheelSequence() {
  return rouletteType === "american" ? AMERICAN_WHEEL_SEQUENCE : WHEEL_SEQUENCE;
}

function wheelStepDeg() {
  return 360 / currentWheelSequence().length;
}

function buildChipTray() {
  els.chipTray.replaceChildren();

  /** @type {HTMLButtonElement | null} */
  let activeChip = null;

  DENOMS.forEach((value, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = String(value);
    btn.dataset.value = String(value);
    btn.style.setProperty("--chip-color", chipPalette(idx));
    btn.title = `Set stake to chip ${fmt.format(value)}`;

    btn.addEventListener("click", () => {
      if (activeChip) activeChip.classList.remove("is-active");
      activeChip = btn;
      btn.classList.add("is-active");
      els.betAmt.value = String(value);
      clampBetAmountField();
    });

    els.chipTray.appendChild(btn);

    if (idx === 0) {
      btn.classList.add("is-active");
      activeChip = btn;
      els.betAmt.value = String(value);
    }
  });

  clampBetAmountField();
}

function chipPalette(seed) {
  const palette = [
    "#fdd76e",
    "#f6b352",
    "#f48fb1",
    "#80cbc4",
    "#aed581",
    "#ce93d8",
    "#ffab91",
    "#90caf9",
    "#ffcdd2",
    "#c5cae9",
    "#ffd54f",
    "#aed581",
  ];
  return palette[seed % palette.length];
}

async function applyChipSheetArtwork() {
  const img = new Image();
  img.src = CHIP_SHEET_FILE;

  try {
    await img.decode();
  } catch (_) {
    return;
  }

  const chipSize = Math.round(img.naturalWidth * 0.1221);
  const gap = Math.round(img.naturalWidth * 0.0244);
  const pitch = chipSize + gap;
  const topRowY = 0;
  const bottomRowY = Math.round(img.naturalHeight * 0.509);

  DENOMS.forEach((value) => {
    const spot = CHIP_SPRITES[value];
    const btn = els.chipTray.querySelector(`[data-value="${value}"]`);
    if (!spot || !btn) return;

    const sx = spot.col * pitch;
    const sy = spot.row === 0 ? topRowY : bottomRowY;

    const canvas = document.createElement("canvas");
    canvas.width = chipSize;
    canvas.height = chipSize;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, chipSize, chipSize, 0, 0, chipSize, chipSize);

    btn.style.backgroundImage = `url("${canvas.toDataURL("image/png")}")`;
    btn.classList.add("has-chip-art");
    chipArtByValue.set(value, btn.style.backgroundImage);
  });

  renderBetChips();
}

function buildNumberGrid() {
  els.grid.replaceChildren();

  const zeroCell = document.createElement("div");
  zeroCell.className = "zero-cell";
  zeroCell.dataset.number = "0";

  const zeroBtn = document.createElement("button");
  zeroBtn.type = "button";
  zeroBtn.textContent = "0";
  zeroBtn.dataset.betKey = betKey("straight", 0);
  zeroBtn.addEventListener("click", () => layStraight(0));
  zeroBtn.addEventListener("mouseenter", () => highlightNumbers([0]));
  zeroBtn.addEventListener("mouseleave", clearColumnRowHighlight);
  zeroBtn.addEventListener("focus", () => highlightNumbers([0]));
  zeroBtn.addEventListener("blur", clearColumnRowHighlight);

  zeroCell.append(zeroBtn);

  if (rouletteType === "american") {
    zeroCell.classList.add("has-double-zero");

    const doubleZeroBtn = document.createElement("button");
    doubleZeroBtn.type = "button";
    doubleZeroBtn.textContent = "00";
    doubleZeroBtn.dataset.betKey = betKey("straight", "00");
    doubleZeroBtn.addEventListener("click", () => layStraight("00"));
    zeroCell.append(doubleZeroBtn);
  }

  zeroCell.style.gridColumn = "1";
  zeroCell.style.gridRow = "1 / span 3";
  els.grid.append(zeroCell);

  for (let column = 0; column < 12; column += 1) {
    columnTriplet(column).forEach((number, rowIdx) => {
      const wrapper = document.createElement("div");
      wrapper.className = `num-cell ${pillClass(number)}`;
      wrapper.dataset.columnRow = String(3 - rowIdx);
      wrapper.dataset.number = String(number);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(number);
      btn.dataset.betKey = betKey("straight", number);
      btn.addEventListener("click", () => layStraight(number));
      btn.addEventListener("mouseenter", () => highlightNumbers([number]));
      btn.addEventListener("mouseleave", clearColumnRowHighlight);
      btn.addEventListener("focus", () => highlightNumbers([number]));
      btn.addEventListener("blur", clearColumnRowHighlight);

      wrapper.append(btn);
      wrapper.style.gridColumn = String(column + 2);
      wrapper.style.gridRow = String(rowIdx + 1);
      els.grid.append(wrapper);
    });
  }

  buildInsideBetZones();

  [3, 2, 1].forEach((row, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "column-bet-cell";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "2:1";
    btn.dataset.betKey = betKey("column", row);
    btn.addEventListener("click", () => layOutsideBet("column", row));
    btn.addEventListener("mouseenter", () => highlightColumnRow(row));
    btn.addEventListener("mouseleave", clearColumnRowHighlight);
    btn.addEventListener("focus", () => highlightColumnRow(row));
    btn.addEventListener("blur", clearColumnRowHighlight);

    wrapper.append(btn);
    wrapper.style.gridColumn = "14";
    wrapper.style.gridRow = String(idx + 1);
    els.grid.append(wrapper);
  });

  clampBetAmountField();
}

function buildInsideBetZones() {
  for (let column = 0; column < 12; column += 1) {
    [0, 1].forEach((rowIdx) => {
      const numbers = [numberAt(column, rowIdx), numberAt(column, rowIdx + 1)];
      appendInsideBetZone("split-vertical", column + 2, rowIdx + 1, numbers, "vertical split");
    });
  }

  for (let column = 0; column < 11; column += 1) {
    [0, 1, 2].forEach((rowIdx) => {
      const numbers = [numberAt(column, rowIdx), numberAt(column + 1, rowIdx)];
      appendInsideBetZone("split-horizontal", column + 2, rowIdx + 1, numbers, "horizontal split");
    });

    [0, 1].forEach((rowIdx) => {
      const numbers = [
        numberAt(column, rowIdx),
        numberAt(column + 1, rowIdx),
        numberAt(column, rowIdx + 1),
        numberAt(column + 1, rowIdx + 1),
      ];
      appendInsideBetZone("corner", column + 2, rowIdx + 1, numbers, "corner");
    });

    const sixNumbers = [0, 1, 2].flatMap((rowIdx) => [numberAt(column, rowIdx), numberAt(column + 1, rowIdx)]);
    appendInsideBetZone("six-line", column + 2, 3, sixNumbers, "six-number rectangle");
  }
}

function appendInsideBetZone(type, gridColumn, gridRow, numbers, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `inside-bet-zone ${type}`;
  btn.dataset.betKey = comboBetKey(numbers);
  btn.setAttribute("aria-label", `${label}: ${numbers.join(", ")}`);
  btn.addEventListener("click", () => layInsideBet(numbers, label));
  btn.addEventListener("mouseenter", () => highlightNumbers(numbers));
  btn.addEventListener("mouseleave", clearColumnRowHighlight);
  btn.addEventListener("focus", () => highlightNumbers(numbers));
  btn.addEventListener("blur", clearColumnRowHighlight);
  btn.style.gridColumn = String(gridColumn);
  btn.style.gridRow = String(gridRow);
  els.grid.append(btn);
}

function numberAt(columnIndex, rowIdx) {
  return columnTriplet(columnIndex)[rowIdx];
}

function highlightColumnRow(row) {
  els.grid.querySelectorAll(".num-cell").forEach((cell) => {
    cell.classList.toggle("is-column-row-highlighted", cell.dataset.columnRow === String(row));
  });
}

function highlightNumbers(numbers) {
  const targetNumbers = new Set(numbers.map(String));
  els.grid.querySelectorAll(".num-cell, .zero-cell").forEach((cell) => {
    cell.classList.toggle("is-column-row-highlighted", targetNumbers.has(cell.dataset.number));
  });
}

function highlightOutsideBet(kind, arg) {
  if (kind === "column") {
    highlightColumnRow(arg);
    return;
  }

  highlightNumbers(numbersForOutsideBet(kind, arg));
}

function numbersForOutsideBet(kind, arg) {
  const numbers = Array.from({ length: 36 }, (_, idx) => idx + 1);

  if (kind === "dozen") {
    if (arg === 1) return numbers.filter((n) => n >= 1 && n <= 12);
    if (arg === 2) return numbers.filter((n) => n >= 13 && n <= 24);
    if (arg === 3) return numbers.filter((n) => n >= 25 && n <= 36);
    return [];
  }

  if (kind === "low") return numbers.filter((n) => n <= 18);
  if (kind === "high") return numbers.filter((n) => n >= 19);
  if (kind === "red") return numbers.filter((n) => RED_NUMBERS.has(n));
  if (kind === "black") return numbers.filter((n) => !RED_NUMBERS.has(n));
  if (kind === "even") return numbers.filter((n) => n % 2 === 0);
  if (kind === "odd") return numbers.filter((n) => n % 2 === 1);

  return [];
}

function clearColumnRowHighlight() {
  els.grid.querySelectorAll(".is-column-row-highlighted").forEach((cell) => {
    cell.classList.remove("is-column-row-highlighted");
  });
}

function columnTriplet(columnIndex) {
  const base = columnIndex * 3;
  return [base + 3, base + 2, base + 1];
}

function pillClass(n) {
  if (n === 0) return "zero";
  return RED_NUMBERS.has(n) ? "number-red" : "number-black";
}

function parseIntegerFieldValue(rawInput) {
  const raw = String(rawInput ?? "").trim();
  if (!raw) return NaN;
  return Number.parseInt(raw, 10);
}

function readBetAmountFromInput() {
  const amt = parseIntegerFieldValue(els.betAmt.value);
  return enforceBetBounds(amt, "Amount next bet uses");
}

function currentChipValue() {
  const value = parseIntegerFieldValue(els.betAmt.value);
  return DENOMS.includes(value) ? value : DENOMS[0];
}

function betKey(kind, arg) {
  return arg == null ? kind : `${kind}:${arg}`;
}

function comboBetKey(numbers) {
  return `inside:${numbers.join("-")}`;
}

function enforceBetBounds(candidate, label) {
  if (!Number.isFinite(candidate)) {
    toast(`${label} needs a plain whole number`);
    return null;
  }
  if (candidate !== Math.round(candidate)) {
    toast(`${label} stays in whole-chip steps`);
    return null;
  }
  if (candidate < MIN_BET || candidate > MAX_BET) {
    toast(`${label} must stay between ${fmt.format(MIN_BET)} and ${fmt.format(MAX_BET)}`);
    return null;
  }
  return candidate;
}

function layStraight(number) {
  if (spinning || settling) return;
  const stake = readBetAmountFromInput();
  if (stake == null) return;

  const bucket = cloth.straight.get(number) ?? 0;
  cloth.straight.set(number, bucket + stake);
  chipValueByBetKey.set(betKey("straight", number), currentChipValue());

  renderAll();
}

function layInsideBet(numbers, label) {
  if (spinning || settling) return;
  const stake = readBetAmountFromInput();
  if (stake == null) return;

  const key = comboBetKey(numbers);
  const bucket = cloth.inside.get(key);
  const payout = 36 / numbers.length;

  cloth.inside.set(key, {
    numbers,
    label,
    payout,
    stake: (bucket?.stake ?? 0) + stake,
  });
  chipValueByBetKey.set(key, currentChipValue());

  renderAll();
}

function layOutsideBet(kind, arg) {
  if (spinning || settling) return;
  const stake = readBetAmountFromInput();
  if (stake == null) return;

  if (kind === "column") {
    if (![1, 2, 3].includes(arg)) {
      toast("Pick one of the 2:1 column buttons.");
      renderAll();
      return;
    }
    cloth.column[/** @type {1 | 2 | 3} */ (arg)] += stake;
    chipValueByBetKey.set(betKey("column", arg), currentChipValue());
  } else if (kind === "dozen") {
    if (![1, 2, 3].includes(arg)) {
      toast("That dozen stripe is sleepy — pick 1 • 2 • 3");
      renderAll();
      return;
    }
    cloth.dozen[/** @type {1 | 2 | 3} */ (arg)] += stake;
    chipValueByBetKey.set(betKey("dozen", arg), currentChipValue());
  } else if (kind === "red" || kind === "black" || kind === "odd" || kind === "even" || kind === "low" || kind === "high") {
    cloth[kind] += stake;
    chipValueByBetKey.set(betKey(kind), currentChipValue());
  } else {
    toast(`That spot (${kind}) is not wired yet.`);
    renderAll();
    return;
  }

  renderAll();
}

function undoBetsBeforeSpin() {
  undoBetsBeforeSpinSilent();
  toast("Returned every cloth bet to your pile.");
}

function deleteAllBets() {
  if (spinning) {
    toast("Wait for the wheel before deleting bets.");
    return;
  }
  if (totalClothStake() === 0) {
    toast("No bets to delete yet.");
    return;
  }

  cancelSettleTimer();
  wipeCloth();
  renderAll();
  toast("Deleted all bets from the table.");
}

function restartSession() {
  if (spinning) {
    toast("Wait for the wheel before restarting.");
    return;
  }

  cancelSettleTimer();
  wipeCloth();
  roundSum = 0;
  totalWins = 0;
  totalLosses = 0;
  totalEarnings = 0;
  els.result.textContent = "—";

  renderAll();
  toast("Restarted everything: bets, wins, losses, sums, and earnings.");
}

function cancelSettleTimer() {
  if (settleTimer) {
    window.clearTimeout(settleTimer);
    settleTimer = 0;
  }
  settling = false;
}

function undoBetsBeforeSpinSilent() {
  if (totalClothStake() === 0) {
    wipeCloth();
    return;
  }

  wipeCloth();

  renderAll();
}

function wipeCloth() {
  cloth.straight.clear();
  cloth.inside.clear();
  chipValueByBetKey.clear();

  cloth.low = 0;
  cloth.high = 0;
  cloth.red = 0;
  cloth.black = 0;
  cloth.odd = 0;
  cloth.even = 0;
  cloth.column[1] = 0;
  cloth.column[2] = 0;
  cloth.column[3] = 0;
  cloth.dozen[1] = 0;
  cloth.dozen[2] = 0;
  cloth.dozen[3] = 0;
}

function totalClothStake() {
  let sum = [...cloth.straight.values()].reduce((a, b) => a + b, 0);
  sum += [...cloth.inside.values()].reduce((a, bet) => a + bet.stake, 0);

  sum += cloth.low + cloth.high + cloth.red + cloth.black + cloth.odd + cloth.even;
  sum += cloth.column[1] + cloth.column[2] + cloth.column[3];
  sum += cloth.dozen[1] + cloth.dozen[2] + cloth.dozen[3];

  return sum;
}

function renderAll() {
  els.spinBtn.disabled = spinning || settling;

  els.typeButtons.forEach((btn) => {
    const active = btn.dataset.rouletteType === rouletteType;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  els.currencyButtons.forEach((btn) => {
    const active = btn.dataset.currencySymbol === currentCurrencySymbol;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  clampBetAmountField();
  renderSummary();
  renderBetChips();

  if (els.betList) {
    els.betList.replaceChildren(...buildBetDescriptions().map(toListItem));
  }
}

function renderSummary() {
  const currentStake = totalClothStake();
  els.summaryWin.textContent = summaryMoney(totalWins);
  els.summaryLoss.textContent = summaryMoney(totalLosses);
  els.summarySum.textContent = signedSummaryMoney(roundSum);
  els.summarySum.classList.toggle("is-positive", roundSum > 0);
  els.summarySum.classList.toggle("is-negative", roundSum < 0);
  els.summaryBet.textContent = summaryMoney(currentStake);
  els.summaryTotal.textContent = signedSummaryMoney(totalEarnings);
  els.summaryTotal.classList.toggle("is-positive", totalEarnings > 0);
  els.summaryTotal.classList.toggle("is-negative", totalEarnings < 0);
}

function renderBetChips() {
  document.querySelectorAll(".bet-chip-marker").forEach((marker) => marker.remove());

  betTotalsByKey().forEach((stake, key) => {
    if (stake <= 0) return;

    const btn = [...document.querySelectorAll("[data-bet-key]")].find((node) => node.dataset.betKey === key);
    if (!btn) return;

    const chip = document.createElement("span");
    chip.className = "bet-chip-marker";

    const label = document.createElement("span");
    label.className = "bet-chip-label";
    label.textContent = fmt.format(stake);
    chip.append(label);

    const chipValue = chipValueByBetKey.get(key) ?? currentChipValue();
    const chipArt = chipArtByValue.get(chipValue);
    if (chipArt) {
      chip.style.backgroundImage = chipArt;
      chip.classList.add("has-chip-art");
    } else {
      chip.style.setProperty("--chip-color", chipPalette(DENOMS.indexOf(chipValue)));
    }

    btn.appendChild(chip);
  });
}

function betTotalsByKey() {
  const totals = new Map();

  cloth.straight.forEach((stake, number) => totals.set(betKey("straight", number), stake));
  cloth.inside.forEach((bet, key) => totals.set(key, bet.stake));
  totals.set(betKey("column", 1), cloth.column[1]);
  totals.set(betKey("column", 2), cloth.column[2]);
  totals.set(betKey("column", 3), cloth.column[3]);
  totals.set(betKey("dozen", 1), cloth.dozen[1]);
  totals.set(betKey("dozen", 2), cloth.dozen[2]);
  totals.set(betKey("dozen", 3), cloth.dozen[3]);
  totals.set(betKey("low"), cloth.low);
  totals.set(betKey("high"), cloth.high);
  totals.set(betKey("red"), cloth.red);
  totals.set(betKey("black"), cloth.black);
  totals.set(betKey("odd"), cloth.odd);
  totals.set(betKey("even"), cloth.even);

  return totals;
}

function toListItem(text) {
  const li = document.createElement("li");
  li.textContent = text;
  return li;
}

function buildBetDescriptions() {
  /** @type {string[]} */
  const lines = [];

  cloth.straight.forEach((stake, number) =>
    lines.push(`Straight • ${number} — stake ${summaryMoney(stake)}`),
  );
  cloth.inside.forEach((bet) => {
    lines.push(`${bet.label} • ${bet.numbers.join(", ")} — stake ${summaryMoney(bet.stake)}`);
  });

  if (cloth.red) lines.push(`Red — stake ${summaryMoney(cloth.red)}`);
  if (cloth.black) lines.push(`Black — stake ${summaryMoney(cloth.black)}`);

  if (cloth.low) lines.push(`Low 1–18 — stake ${summaryMoney(cloth.low)}`);
  if (cloth.high) lines.push(`High 19–36 — stake ${summaryMoney(cloth.high)}`);

  if (cloth.even) lines.push(`Even — stake ${summaryMoney(cloth.even)}`);
  if (cloth.odd) lines.push(`Odd — stake ${summaryMoney(cloth.odd)}`);

  [1, 2, 3].forEach((c) => {
    if (!cloth.column[c]) return;
    lines.push(`Column ${c} (2:1) — stake ${summaryMoney(cloth.column[c])}`);
  });

  [1, 2, 3].forEach((d) => {
    if (!cloth.dozen[d]) return;
    const label = d === 1 ? "1st twelve" : d === 2 ? "2nd twelve" : "3rd twelve";
    lines.push(`${label} — stake ${summaryMoney(cloth.dozen[d])}`);
  });

  if (!lines.length) lines.push("No chips on cloth yet.");

  lines.push(`Cloth tally — ${summaryMoney(totalClothStake())}`);

  return lines;
}

function randomEuroOutcome() {
  const sequence = currentWheelSequence();
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return sequence[buf[0] % sequence.length];
}

function handleSpin() {
  if (spinning || settling) return;

  const clothStake = totalClothStake();
  if (clothStake === 0) {
    toast("Lay some pretend chips before you spin.");
    return;
  }

  spinning = true;
  renderAll();

  const outcome = randomEuroOutcome();
  const credit = payoutsForOutcome(outcome); // totals while cloth still remembers chip spots

  void animateWheelToward(outcome, () => {
    const net = credit - clothStake;
    roundSum = net;
    if (net >= 0) {
      totalWins += net;
    } else {
      totalLosses += Math.abs(net);
    }
    totalEarnings += net;

    spinning = false;
    settling = true;
    els.result.textContent = numberLabelPlain(outcome);

    toast(
      credit > 0
        ? `Round result: ${signedSummaryMoney(net)}.`
        : "Spin swallowed every cloth stake this round.",
    );

    renderAll();

    settleTimer = window.setTimeout(() => {
      settleTimer = 0;
      settling = false;
      wipeCloth();
      renderAll();
    }, 5000);
  });
}

function payoutsForOutcome(outcome) {
  let credit = 0;

  cloth.straight.forEach((stake, number) => {
    if (number === outcome) credit += stake * 36;
  });
  cloth.inside.forEach((bet) => {
    if (bet.numbers.includes(outcome)) credit += bet.stake * bet.payout;
  });

  credit += tallyEvenBet(cloth.red, outcome, RED_NUMBERS.has(outcome));
  credit += tallyEvenBet(cloth.black, outcome, RED_NUMBERS.has(outcome) === false && outcome !== 0 && outcome !== "00");

  credit += tallyEvenBet(cloth.even, outcome, typeof outcome === "number" && outcome !== 0 && outcome % 2 === 0);
  credit += tallyEvenBet(cloth.odd, outcome, typeof outcome === "number" && outcome !== 0 && outcome % 2 === 1);

  credit += tallyEvenBet(cloth.low, outcome, typeof outcome === "number" && outcome >= 1 && outcome <= 18);
  credit += tallyEvenBet(cloth.high, outcome, typeof outcome === "number" && outcome >= 19 && outcome <= 36);

  credit += tallyTableBet(cloth.dozen[1], outcome, dozenContains(1, outcome));
  credit += tallyTableBet(cloth.dozen[2], outcome, dozenContains(2, outcome));
  credit += tallyTableBet(cloth.dozen[3], outcome, dozenContains(3, outcome));
  credit += tallyTableBet(cloth.column[1], outcome, columnContains(1, outcome));
  credit += tallyTableBet(cloth.column[2], outcome, columnContains(2, outcome));
  credit += tallyTableBet(cloth.column[3], outcome, columnContains(3, outcome));

  return credit;
}

function tallyEvenBet(stake, outcome, wins) {
  void outcome;
  if (!stake) return 0;

  const ok = !!wins;
  return ok ? stake * 2 : 0;
}

function tallyTableBet(stake, outcome, wins) {
  void outcome;
  if (!stake) return 0;
  return wins ? stake * 3 : 0;
}

function dozenContains(dozenIdx, outcome) {
  if (typeof outcome !== "number") return false;
  if (outcome <= 0) return false;
  if (dozenIdx === 1) return outcome >= 1 && outcome <= 12;
  if (dozenIdx === 2) return outcome >= 13 && outcome <= 24;
  if (dozenIdx === 3) return outcome >= 25 && outcome <= 36;

  return false;
}

function columnContains(columnIdx, outcome) {
  if (typeof outcome !== "number") return false;
  if (outcome <= 0) return false;
  return outcome % 3 === columnIdx % 3;
}

/**
 * Spins the faux wheel visually. Runs `done` when easing stops.
 *
 * @param {number} outcome
 * @param {(reason?: unknown) => void} done
 */
function animateWheelToward(outcome, done) {
  const reduceMotion =
    typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  if (reduceMotion?.matches === true || !els.wheel) {
    done(undefined);
    return;
  }

  const sequence = currentWheelSequence();
  const step = wheelStepDeg();
  const index = Math.max(sequence.indexOf(outcome), 0);

  /** Rotate so wedge midpoint sits beneath the pointer mark */
  const targetAngleToPointer = step / 2 + index * step;

  const extraTurns = 6 + Math.floor(Math.random() * 5);
  const delta = -(extraTurns * 360) - targetAngleToPointer;

  cumulativeRotationDeg += delta;

  els.wheel.style.transition = "transform 4.2s cubic-bezier(0.12, 0.65, 0.07, 1)";
  els.wheel.style.transform = `rotate(${cumulativeRotationDeg}deg)`;

  let settled = false;
  const finalize = (_reason) => {
    if (settled || !els.wheel) return;
    settled = true;
    window.clearTimeout(safetyTimer);

    cumulativeRotationDeg = ((cumulativeRotationDeg % 360) + 360) % 360;

    els.wheel.style.transition = "none";
    els.wheel.style.transform = `rotate(${cumulativeRotationDeg}deg)`;

    queueMicrotask(() => {
      done(undefined);
    });
  };

  const safetyTimer = window.setTimeout(() => finalize(undefined), 12000);

  els.wheel.addEventListener("transitionend", () => finalize(undefined), { once: true });
  els.wheel.addEventListener("transitioncancel", () => finalize(undefined), { once: true });
}
