/**
 * Blackjack — bank screen, then table with full game rules.
 */

const DENOMS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000];
const CHIP_SHEET_FILE = "../roulette/rb_chips.png";
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

const CARD_SHEET_FILE = "playing%20cards.png";
const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const MIN_BET = 1;
const MAX_BET = 99_999_999;
const BLACKJACK_PAYOUT = 1.5;

const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/** @type {Map<number, string>} */
const chipArtByValue = new Map();

let currentCurrencySymbol = "$";
let roundSum = 0;
let totalWins = 0;
let totalLosses = 0;
let totalEarnings = 0;
let handBet = 0;
let pendingBet = 0;
let toastTimer = 0;
/** @type {"setup" | "play"} */
let screen = "setup";

/** @type {{ sheetW: number, sheetH: number, cellW: number, cellH: number, cols: number, rows: number } | null} */
let sheetMetrics = null;

/** @type {Array<{ suit: number, rank: number }>} */
let deck = [];
/** @type {Array<{ suit: number, rank: number }>} */
let playerCards = [];
/** @type {Array<{ suit: number, rank: number }>} */
let dealerCards = [];

/** @type {"idle" | "player-turn" | "dealer-turn" | "done"} */
let phase = "idle";
let dealerHoleHidden = true;
let tableAnimating = false;

const DISPLAY_CARD_WIDTH = 92;
const CARD_DEAL_MS = 380;
const DEAL_STAGGER_MS = 200;
const DEALER_HIT_PAUSE_MS = 450;

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheRefs();
  appendToastIfNeeded();
  buildChipTray();
  void applyChipSheetArtwork();
  wireUi();
  renderSummary();
  updateTableControls();
  showSetup();
  void loadCardSheet();
});

function cacheRefs() {
  els.setup = document.getElementById("bj-setup");
  els.play = document.getElementById("bj-play");
  els.betAmt = document.getElementById("bet-amount-input");
  els.chipTray = document.getElementById("chip-rack");
  els.summaryWin = document.getElementById("summary-win");
  els.summaryLoss = document.getElementById("summary-loss");
  els.summarySum = document.getElementById("summary-sum");
  els.summaryBet = document.getElementById("summary-bet");
  els.summaryTotal = document.getElementById("summary-total");
  els.currencyButtons = [...document.querySelectorAll("[data-currency-symbol]")];
  els.btnDeal = document.getElementById("btn-deal");
  els.btnClearBet = document.getElementById("btn-clear-bet");
  els.btnRestart = document.getElementById("btn-restart-session");
  els.btnBackBank = document.getElementById("btn-back-bank");
  els.handStakeLabel = document.getElementById("hand-stake-label");
  els.dealerHand = document.getElementById("dealer-hand");
  els.playerHand = document.getElementById("player-hand");
  els.dealerTotal = document.getElementById("dealer-total");
  els.playerTotal = document.getElementById("player-total");
  els.status = document.getElementById("bj-status");
  els.btnHit = document.getElementById("btn-hit");
  els.btnStand = document.getElementById("btn-stand");
  els.btnHow = document.getElementById("btn-how");
  els.howDialog = document.getElementById("how-dialog");
}

function appendToastIfNeeded() {
  if (document.getElementById("toast")) {
    els.toast = document.getElementById("toast");
    return;
  }
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
  let n = Math.floor(Number(els.betAmt.value));
  if (!Number.isFinite(n)) n = DENOMS[0];
  n = Math.max(1, Math.min(99_999_999, n));
  els.betAmt.value = String(n);
}

function addChipToBet(value) {
  if (screen !== "setup") return;
  const next = pendingBet + value;
  if (next > MAX_BET) {
    pendingBet = MAX_BET;
    renderSummary();
    toast(`Bet capped at ${summaryMoney(MAX_BET)}.`);
    return;
  }
  pendingBet = next;
  renderSummary();
}

function renderSummary() {
  const displayBet = screen === "setup" ? pendingBet : handBet;
  els.summaryWin.textContent = summaryMoney(totalWins);
  els.summaryLoss.textContent = summaryMoney(totalLosses);
  els.summarySum.textContent = signedSummaryMoney(roundSum);
  els.summarySum.classList.toggle("is-positive", roundSum > 0);
  els.summarySum.classList.toggle("is-negative", roundSum < 0);
  els.summaryBet.textContent = summaryMoney(displayBet);
  els.summaryTotal.textContent = signedSummaryMoney(totalEarnings);
  els.summaryTotal.classList.toggle("is-positive", totalEarnings > 0);
  els.summaryTotal.classList.toggle("is-negative", totalEarnings < 0);

  els.currencyButtons.forEach((btn) => {
    const active = btn.dataset.currencySymbol === currentCurrencySymbol;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });

  if (els.handStakeLabel) {
    els.handStakeLabel.textContent =
      handBet > 0 ? `hand bet: ${summaryMoney(handBet)}` : "";
  }
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
    btn.title = `Add ${fmt.format(value)} to bet`;

    btn.addEventListener("click", () => {
      if (activeChip) activeChip.classList.remove("is-active");
      activeChip = btn;
      btn.classList.add("is-active");
      els.betAmt.value = String(value);
      clampBetAmountField();
      addChipToBet(value);
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
}

function clearBetSelection() {
  pendingBet = 0;
  const first = els.chipTray.querySelector(".chip");
  els.chipTray.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
  first?.classList.add("is-active");
  els.betAmt.value = String(DENOMS[0]);
  clampBetAmountField();
  renderSummary();
  toast("All bets cleared.");
}

function restartSession() {
  roundSum = 0;
  totalWins = 0;
  totalLosses = 0;
  totalEarnings = 0;
  handBet = 0;
  phase = "idle";
  playerCards = [];
  dealerCards = [];
  clearBetSelection();
  showSetup();
  toast("Session cleared — wins, losses, and earnings reset.");
}

function showSetup() {
  screen = "setup";
  phase = "idle";
  els.setup.hidden = false;
  els.play.hidden = true;
  renderSummary();
  updateTableControls();
}

function showPlay() {
  screen = "play";
  handBet = pendingBet;
  els.setup.hidden = true;
  els.play.hidden = false;
  renderSummary();
  startHand();
}

function isHandInProgress() {
  return phase === "player-turn" || phase === "dealer-turn";
}

function wireUi() {
  els.btnHow?.addEventListener("click", () => els.howDialog?.showModal());
  els.btnDeal?.addEventListener("click", () => {
    if (pendingBet < MIN_BET) {
      toast("Tap chips to build a bet first.");
      return;
    }
    showPlay();
  });
  els.btnClearBet?.addEventListener("click", clearBetSelection);
  els.btnRestart?.addEventListener("click", restartSession);
  els.btnBackBank?.addEventListener("click", () => {
    if (isHandInProgress()) {
      toast("Finish this hand before changing your bet.");
      return;
    }
    showSetup();
    toast("Back at the bank — tap chips to set your next bet.");
  });
  els.btnHit?.addEventListener("click", () => handleHit());
  els.btnStand?.addEventListener("click", handleStand);

  els.currencyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentCurrencySymbol = btn.dataset.currencySymbol || "$";
      renderSummary();
    });
  });
}

/* —— Deck & hand math —— */

function buildDeck() {
  const cards = [];
  for (let suit = 0; suit < 4; suit += 1) {
    for (let rank = 0; rank < 13; rank += 1) {
      cards.push({ suit, rank });
    }
  }
  return cards;
}

function shuffleDeck(cards) {
  const arr = cards.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function ensureDeck() {
  if (deck.length < 15) {
    deck = shuffleDeck(buildDeck());
  }
}

function drawCard() {
  ensureDeck();
  return deck.pop();
}

function handTotals(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 0) {
      aces += 1;
      total += 11;
    } else if (card.rank >= 9) {
      total += 10;
    } else {
      total += card.rank + 1;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const soft = aces > 0 && total <= 21;
  return { total, soft };
}

function isBlackjack(cards) {
  return cards.length === 2 && handTotals(cards).total === 21;
}

function isBust(cards) {
  return handTotals(cards).total > 21;
}

function formatHandTotal(cards, prefix = "total") {
  if (isBust(cards)) {
    const { total } = handTotals(cards);
    return `total: bust (${total})`;
  }
  const { total, soft } = handTotals(cards);
  if (prefix === "showing") return `showing: ${total}`;
  return `total: ${total}${soft ? " (soft)" : ""}`;
}

function cardLabel(card) {
  return `${RANKS[card.rank]} of ${SUITS[card.suit]}`;
}

function dealerUpcardNeedsPeek() {
  const up = dealerCards[0];
  if (!up) return false;
  return up.rank === 0 || up.rank >= 9;
}

/* —— Rendering —— */

function loadCardSheet() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cols = 13;
      const rows = 5;
      sheetMetrics = {
        sheetW: img.naturalWidth,
        sheetH: img.naturalHeight,
        cols,
        rows,
        cellW: img.naturalWidth / cols,
        cellH: img.naturalHeight / rows,
      };
      resolve();
    };
    img.onerror = () => reject(new Error("Could not load playing card sheet"));
    img.src = CARD_SHEET_FILE;
  });
}

function spriteColRow(suitIndex, rankIndex, faceDown = false) {
  if (faceDown) return { col: 0, row: 4 };
  return { col: rankIndex, row: suitIndex };
}

function applyCardSprite(el, col, row) {
  if (!sheetMetrics) return;
  const { cellW, cellH, sheetW, sheetH } = sheetMetrics;
  const scale = DISPLAY_CARD_WIDTH / cellW;
  const displayH = cellH * scale;

  el.style.width = `${DISPLAY_CARD_WIDTH}px`;
  el.style.height = `${displayH}px`;
  el.style.backgroundImage = `url("${CARD_SHEET_FILE}")`;
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundSize = `${sheetW * scale}px ${sheetH * scale}px`;
  el.style.backgroundPosition = `${-col * cellW * scale}px ${-row * cellH * scale}px`;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function delay(ms) {
  if (prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForMotion(el, fallbackMs = CARD_DEAL_MS) {
  if (prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    el.addEventListener("animationend", finish, { once: true });
    el.addEventListener("transitionend", finish, { once: true });
    window.setTimeout(finish, fallbackMs + 60);
  });
}

function applyCardFace(el, card, faceDown = false) {
  const { col, row } = spriteColRow(card.suit, card.rank, faceDown);
  applyCardSprite(el, col, row);
  el.classList.toggle("is-face-down", faceDown);
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", faceDown ? "Hidden card" : cardLabel(card));
}

function createCardElement(card, faceDown = false) {
  const el = document.createElement("span");
  el.className = "playing-card";
  applyCardFace(el, card, faceDown);
  return el;
}

async function appendCardAnimated(container, card, faceDown = false) {
  const el = createCardElement(card, faceDown);
  if (prefersReducedMotion()) {
    container.append(el);
    return el;
  }

  el.classList.add("card-deal");
  container.append(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add("card-dealt"));
  });
  await waitForMotion(el);
  el.classList.remove("card-deal", "card-dealt");
  return el;
}

async function flipHoleCard(el, card) {
  if (!el || !card) return;
  if (prefersReducedMotion()) {
    applyCardFace(el, card, false);
    return;
  }

  el.classList.add("card-flip");
  await delay(180);
  applyCardFace(el, card, false);
  await waitForMotion(el, 480);
  el.classList.remove("card-flip");
}

async function animateTotalOutput(el, cards, prefix = "total") {
  if (!el) return;

  const nextText = formatHandTotal(cards, prefix);
  const bust = isBust(cards);
  const wasBust = el.classList.contains("is-bust");

  el.classList.remove("total-pop", "total-bust-flash");
  void el.offsetWidth;

  el.textContent = nextText;
  el.classList.toggle("is-bust", bust);

  if (prefersReducedMotion()) return;

  if (bust && !wasBust) {
    el.classList.add("total-bust-flash");
  } else {
    el.classList.add("total-pop");
  }

  await waitForMotion(el, 520);
}

function clearTableVisual() {
  clearHand(els.playerHand);
  clearHand(els.dealerHand);
  if (els.playerTotal) {
    els.playerTotal.textContent = "";
    els.playerTotal.classList.remove("is-bust", "total-pop", "total-bust-flash");
  }
  if (els.dealerTotal) {
    els.dealerTotal.textContent = "";
    els.dealerTotal.classList.remove("is-bust", "total-pop", "total-bust-flash");
  }
}

async function refreshTotalsAnimated() {
  await animateTotalOutput(els.playerTotal, playerCards);
  if (dealerHoleHidden && dealerCards.length >= 2) {
    await animateTotalOutput(els.dealerTotal, [dealerCards[0]], "showing");
  } else {
    await animateTotalOutput(els.dealerTotal, dealerCards);
  }
}

async function dealOpeningHand() {
  clearTableVisual();
  await appendCardAnimated(els.playerHand, playerCards[0], false);
  await delay(DEAL_STAGGER_MS);
  await appendCardAnimated(els.dealerHand, dealerCards[0], false);
  await delay(DEAL_STAGGER_MS);
  await appendCardAnimated(els.playerHand, playerCards[1], false);
  await delay(DEAL_STAGGER_MS);
  await appendCardAnimated(els.dealerHand, dealerCards[1], true);
  await refreshTotalsAnimated();
}

async function withTableLock(fn) {
  if (tableAnimating) return;
  tableAnimating = true;
  updateTableControls();
  try {
    await fn();
  } finally {
    tableAnimating = false;
    updateTableControls();
  }
}

function updateTableControls() {
  const canAct = phase === "player-turn" && !tableAnimating;
  if (els.btnHit) els.btnHit.disabled = !canAct;
  if (els.btnStand) els.btnStand.disabled = !canAct;
  if (els.btnBackBank) els.btnBackBank.disabled = isHandInProgress() || tableAnimating;
}

/* —— Game flow —— */

function startHand() {
  if (!sheetMetrics) {
    els.status.textContent = "Loading cards…";
    void loadCardSheet().then(() => startHand());
    return;
  }

  void withTableLock(async () => {
    playerCards = [];
    dealerCards = [];
    dealerHoleHidden = true;
    phase = "player-turn";

    playerCards.push(drawCard());
    dealerCards.push(drawCard());
    playerCards.push(drawCard());
    dealerCards.push(drawCard());

    await dealOpeningHand();
    els.status.textContent = `Bet ${summaryMoney(handBet)} — hit or stand.`;
    await resolveInitialBlackjacks();
  });
}

async function resolveInitialBlackjacks() {
  const playerBj = isBlackjack(playerCards);
  const peekDealer = dealerUpcardNeedsPeek();
  const dealerBj = peekDealer && isBlackjack(dealerCards);

  if (playerBj && dealerBj) {
    await revealDealerHole();
    finishHand(0, "Push — both have blackjack.");
    return;
  }

  if (playerBj) {
    const net = Math.floor(handBet * BLACKJACK_PAYOUT);
    finishHand(net, `Blackjack! You win ${summaryMoney(net)}.`);
    return;
  }

  if (dealerBj) {
    await revealDealerHole();
    finishHand(-handBet, `Dealer has blackjack. You lose ${summaryMoney(handBet)}.`);
    return;
  }

  phase = "player-turn";
  updateTableControls();
}

function handleHit() {
  if (phase !== "player-turn" || tableAnimating) return;

  void withTableLock(async () => {
    const card = drawCard();
    playerCards.push(card);
    await appendCardAnimated(els.playerHand, card, false);
    await animateTotalOutput(els.playerTotal, playerCards);

    const { total } = handTotals(playerCards);
    if (total > 21) {
      await revealDealerHole();
      finishHand(-handBet, `Bust — you went over 21. Lost ${summaryMoney(handBet)}.`);
      return;
    }

    if (total === 21) {
      await runDealerTurn();
      return;
    }

    els.status.textContent = `Your total is ${total}. Hit or stand.`;
  });
}

async function runDealerTurn() {
  if (phase !== "player-turn") return;
  phase = "dealer-turn";
  updateTableControls();
  await revealDealerHole();
  await playDealerTurn();
}

function handleStand() {
  if (phase !== "player-turn") return;
  void withTableLock(runDealerTurn);
}

async function revealDealerHole() {
  if (!dealerHoleHidden) return;
  dealerHoleHidden = false;
  const holeEl = els.dealerHand?.children[1];
  if (holeEl && dealerCards[1]) {
    await flipHoleCard(holeEl, dealerCards[1]);
  }
  await animateTotalOutput(els.dealerTotal, dealerCards);
}

async function playDealerTurn() {
  els.status.textContent = "Dealer's turn…";

  let dealer = handTotals(dealerCards);
  while (dealer.total < 17) {
    await delay(DEALER_HIT_PAUSE_MS);
    const card = drawCard();
    dealerCards.push(card);
    await appendCardAnimated(els.dealerHand, card, false);
    dealer = handTotals(dealerCards);
    await animateTotalOutput(els.dealerTotal, dealerCards);
  }

  await delay(180);
  resolveShowdown();
}

function resolveShowdown() {
  const player = handTotals(playerCards);
  const dealer = handTotals(dealerCards);

  if (dealer.total > 21) {
    finishHand(handBet, `Dealer busts. You win ${summaryMoney(handBet)}!`);
    return;
  }

  if (player.total > dealer.total) {
    finishHand(handBet, `You win ${summaryMoney(handBet)} (${player.total} vs ${dealer.total}).`);
    return;
  }

  if (player.total < dealer.total) {
    finishHand(-handBet, `You lose ${summaryMoney(handBet)} (${player.total} vs ${dealer.total}).`);
    return;
  }

  finishHand(0, `Push — both have ${player.total}.`);
}

function finishHand(net, message) {
  phase = "done";
  roundSum = net;
  totalEarnings += net;
  if (net > 0) totalWins += net;
  else if (net < 0) totalLosses += Math.abs(net);

  void refreshTotalsAnimated();
  renderSummary();
  updateTableControls();
  els.status.textContent = `${message} Tap ← change bet for another hand.`;
  toast(message);
}

function clearHand(container) {
  container.replaceChildren();
}
