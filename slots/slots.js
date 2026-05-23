/**
 * Slots — machine, bet, lever, and customization (saved in this browser).
 */

import {
  STORAGE_KEY,
  SYMBOL_IDS,
  SYMBOL_LABELS,
  DEFAULT_MACHINE_COLORS,
  defaultPayouts,
  defaultSymbols,
  formatPayoutValue,
  machineGradient,
} from "./slots-config.js";
import { mountReels } from "./slots-reels.js";

const BET_STEPS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  12, 15, 20, 25, 30, 35, 40, 45, 50,
  60, 70, 80, 90, 100,
  125, 150, 175, 200, 225, 250, 275, 300,
  350, 400, 450, 500,
  600, 700, 800, 900, 1000,
  1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000,
];
const MIN_BET = BET_STEPS[0];
const MAX_BET = BET_STEPS[BET_STEPS.length - 1];

function nextBetStep(value) {
  for (const step of BET_STEPS) {
    if (step > value) return step;
  }
  return MAX_BET;
}

function prevBetStep(value) {
  let prev = BET_STEPS[0];
  for (const step of BET_STEPS) {
    if (step >= value) return prev;
    prev = step;
  }
  return prev;
}

const els = {
  hint: document.getElementById("slots-hint"),
  status: document.getElementById("slots-status"),
  betValue: document.getElementById("bet-value"),
  betDown: document.getElementById("bet-down"),
  betUp: document.getElementById("bet-up"),
  lever: document.getElementById("lever"),
  leverWrap: document.getElementById("lever-wrap"),
  machineCabinet: document.getElementById("machine-cabinet"),
  btnCustomize: document.getElementById("btn-customize"),
  customizeDialog: document.getElementById("customize-dialog"),
  customizeClose: document.getElementById("customize-close"),
  customizeDone: document.getElementById("customize-done"),
  resetSettings: document.getElementById("reset-settings"),
  payoutList: document.getElementById("payout-list"),
  symbolList: document.getElementById("symbol-list"),
  colorList: document.getElementById("color-list"),
  colorPicker: document.getElementById("color-picker"),
  colorAdd: document.getElementById("color-add"),
  colorPreview: document.getElementById("color-preview"),
  payoutEditor: document.getElementById("payout-editor"),
  payoutEditorCombo: document.getElementById("payout-editor-combo"),
  payoutAmountPrefix: document.getElementById("payout-amount-prefix"),
  payoutAmountInput: document.getElementById("payout-amount-input"),
  payoutTypeButtons: document.querySelectorAll(".type-btn"),
  payoutCancel: document.getElementById("payout-cancel"),
  payoutSave: document.getElementById("payout-save"),
};

let bet = 1;
/** @type {import("./slots-config.js").PayoutRule[]} */
let payouts = defaultPayouts();
/** @type {Record<string, boolean>} */
let symbols = defaultSymbols();
/** @type {string[]} */
let machineColors = [...DEFAULT_MACHINE_COLORS];

/** @type {import("./slots-config.js").PayoutRule | null} */
let editingPayout = null;

const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const reelController = mountReels(els.machineCabinet, {
  onSpinEnd() {
    els.machineCabinet.classList.remove("machine-cabinet--spinning");
    els.lever.disabled = false;
    els.betDown.disabled = false;
    els.betUp.disabled = false;
  },
});

function syncReelSettings() {
  reelController.updateSettings({ symbols, payouts, bet });
}

function renderBet() {
  els.betValue.textContent = `$${fmt.format(bet)}`;
}

function setStatus(message) {
  els.status.textContent = message;
}

function saveSettings() {
  const payload = {
    payouts,
    symbols,
    machineColors,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    setStatus("Could not save settings in this browser.");
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.payouts) && data.payouts.length) payouts = data.payouts;
    if (data.symbols && typeof data.symbols === "object") symbols = { ...defaultSymbols(), ...data.symbols };
    if (Array.isArray(data.machineColors) && data.machineColors.length) {
      machineColors = data.machineColors.filter((c) => typeof c === "string");
    }
  } catch {
    /* keep defaults */
  }
}

function applyMachineColors() {
  const fill = machineGradient(machineColors);
  els.machineCabinet.style.setProperty("--machine-tint", fill);
}

function syncColorPicker() {
  if (machineColors.length) {
    els.colorPicker.value = machineColors[machineColors.length - 1];
  }
}

function renderPayoutList() {
  els.payoutList.replaceChildren();
  payouts.forEach((rule) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "payout-row";
    if (rule.locked) btn.classList.add("payout-row--locked");
    if (!rule.enabled) btn.classList.add("payout-row--off");

    const name = document.createElement("span");
    name.className = "payout-row-name";
    name.textContent = rule.label;

    const value = document.createElement("span");
    value.className = "payout-row-value";
    value.textContent = formatPayoutValue(rule);

    btn.append(name, value);

    if (rule.locked) {
      btn.disabled = true;
      btn.title = "Fixed — board-game signal only";
    } else {
      btn.addEventListener("click", () => openPayoutEditor(rule));
    }

    li.append(btn);
    els.payoutList.append(li);
  });
}

function renderSymbolList() {
  els.symbolList.replaceChildren();
  SYMBOL_IDS.forEach((id) => {
    const li = document.createElement("li");
    const label = document.createElement("label");
    label.className = "symbol-toggle";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = symbols[id] !== false;
    input.addEventListener("change", () => {
      symbols[id] = input.checked;
      syncReelSettings();
      saveSettings();
    });

    const text = document.createElement("span");
    text.textContent = SYMBOL_LABELS[id] || id;

    label.append(input, text);
    li.append(label);
    els.symbolList.append(li);
  });
}

function renderColorList() {
  els.colorList.replaceChildren();
  machineColors.forEach((color, index) => {
    const li = document.createElement("li");
    li.className = "color-chip-row";

    const swatch = document.createElement("span");
    swatch.className = "color-swatch";
    swatch.style.background = color;

    const code = document.createElement("span");
    code.className = "color-code";
    code.textContent = color;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn-small btn-muted";
    remove.textContent = "remove";
    remove.disabled = machineColors.length <= 1;
    remove.addEventListener("click", () => {
      machineColors.splice(index, 1);
      renderColorList();
      applyMachineColors();
      saveSettings();
    });

    li.append(swatch, code, remove);
    els.colorList.append(li);
  });

  els.colorPreview.style.background = machineGradient(machineColors);
}

function openCustomize() {
  renderPayoutList();
  renderSymbolList();
  renderColorList();
  syncColorPicker();
  applyMachineColors();
  if (typeof els.customizeDialog.showModal === "function") {
    els.customizeDialog.showModal();
  }
}

function closeCustomize() {
  if (els.customizeDialog.open) els.customizeDialog.close();
}

function openPayoutEditor(rule) {
  editingPayout = rule;
  els.payoutEditorCombo.textContent = rule.label;
  els.payoutAmountInput.value = String(Math.max(0, Math.floor(rule.amount)));
  setEditorType(rule.type === "take" ? "take" : rule.type === "times" ? "times" : "money");
  if (typeof els.payoutEditor.showModal === "function") {
    els.payoutEditor.showModal();
  }
  els.payoutAmountInput.focus();
}

function closePayoutEditor() {
  editingPayout = null;
  if (els.payoutEditor.open) els.payoutEditor.close();
}

/** @param {"money" | "times" | "take"} type */
function setEditorType(type) {
  els.payoutTypeButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.type === type);
  });

  if (type === "times") {
    els.payoutAmountPrefix.textContent = "×";
  } else if (type === "take") {
    els.payoutAmountPrefix.textContent = "−$";
  } else {
    els.payoutAmountPrefix.textContent = "$";
  }
}

function activeEditorType() {
  const active = [...els.payoutTypeButtons].find((btn) => btn.classList.contains("is-active"));
  return /** @type {"money" | "times" | "take"} */ (active?.dataset.type || "money");
}

function savePayoutEdit() {
  if (!editingPayout) return;
  const amount = Math.max(0, Math.floor(Number(els.payoutAmountInput.value) || 0));
  const type = activeEditorType();

  editingPayout.type = type;
  editingPayout.amount = amount;

  renderPayoutList();
  saveSettings();
  closePayoutEditor();
  setStatus(`Updated “${editingPayout.label}”.`);
}

function resetAllSettings() {
  payouts = defaultPayouts();
  symbols = defaultSymbols();
  machineColors = [...DEFAULT_MACHINE_COLORS];
  els.colorPicker.value = DEFAULT_MACHINE_COLORS[0];
  renderPayoutList();
  renderSymbolList();
  renderColorList();
  applyMachineColors();
  saveSettings();
  setStatus("Settings reset to defaults.");
}

els.betDown.addEventListener("click", () => {
  if (bet <= MIN_BET) {
    setStatus(`Bet is already at the minimum ($${fmt.format(MIN_BET)}).`);
    return;
  }
  bet = prevBetStep(bet);
  renderBet();
  syncReelSettings();
  setStatus("");
});

els.betUp.addEventListener("click", () => {
  if (bet >= MAX_BET) {
    setStatus(`Bet cannot go above $${fmt.format(MAX_BET)}.`);
    return;
  }
  bet = nextBetStep(bet);
  renderBet();
  syncReelSettings();
  setStatus("");
});

els.lever.addEventListener("click", () => {
  if (reelController.isSpinning()) return;
  els.lever.disabled = true;
  els.betDown.disabled = true;
  els.betUp.disabled = true;
  els.machineCabinet.classList.add("machine-cabinet--spinning");
  setStatus("");
  void reelController.spin(els.leverWrap);
});

els.btnCustomize.addEventListener("click", openCustomize);
els.customizeClose.addEventListener("click", closeCustomize);
els.customizeDone.addEventListener("click", () => {
  saveSettings();
  closeCustomize();
});
els.resetSettings.addEventListener("click", resetAllSettings);

els.colorAdd.addEventListener("click", () => {
  machineColors.push(els.colorPicker.value);
  renderColorList();
  applyMachineColors();
  saveSettings();
});

els.colorPicker.addEventListener("input", () => {
  if (machineColors.length === 1) {
    machineColors[0] = els.colorPicker.value;
    renderColorList();
    applyMachineColors();
    saveSettings();
  }
});

els.payoutTypeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setEditorType(/** @type {"money" | "times" | "take"} */ (btn.dataset.type));
  });
});

els.payoutCancel.addEventListener("click", closePayoutEditor);
els.payoutSave.addEventListener("click", savePayoutEdit);

els.customizeDialog.addEventListener("close", saveSettings);

els.payoutEditor.addEventListener("cancel", () => {
  editingPayout = null;
});

loadSettings();
syncColorPicker();
applyMachineColors();
renderBet();
syncReelSettings();
