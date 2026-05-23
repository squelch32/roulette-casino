/**
 * Default slots settings — from slot machine payouts.png
 */

export const STORAGE_KEY = "casino-slots-settings";

export const DEFAULT_MACHINE_COLORS = ["#ffde00"];

export const SYMBOL_IDS = [
  "cherry",
  "bar",
  "plum",
  "lemon",
  "grape",
  "watermelon",
  "orange",
  "apple",
  "clover",
  "coin",
  "diamond",
  "seven",
  "mult2",
  "mult3",
  "mult5",
  "mult10",
  "mult25",
  "mult50",
];

export const SYMBOL_LABELS = {
  cherry: "cherry",
  bar: "bar",
  plum: "plum",
  lemon: "lemon",
  grape: "grape",
  watermelon: "watermelon",
  orange: "orange",
  apple: "apple",
  clover: "clover",
  coin: "coin",
  diamond: "diamond",
  seven: "seven",
  mult2: "×2",
  mult3: "×3",
  mult5: "×5",
  mult10: "×10",
  mult25: "×25",
  mult50: "×50",
};

/** @typedef {"money" | "times" | "take" | "signal"} PayoutType */

/**
 * @typedef {object} PayoutRule
 * @property {string} id
 * @property {string} label
 * @property {PayoutType} type
 * @property {number} amount
 * @property {boolean} locked
 * @property {boolean} enabled
 * @property {string} [symbol]
 * @property {"none" | "count" | "triple"} [match]
 * @property {number} [count]
 */

/** @returns {PayoutRule[]} */
export function defaultPayouts() {
  return [
    { id: "none", label: "none of a kind", type: "money", amount: 0, locked: false, enabled: true, match: "none" },
    { id: "cherry-1", label: "1 cherry", symbol: "cherry", match: "count", count: 1, type: "money", amount: 15, locked: false, enabled: true },
    { id: "cherry-2", label: "2 cherries", symbol: "cherry", match: "count", count: 2, type: "money", amount: 30, locked: false, enabled: true },
    { id: "cherry-3", label: "3 cherries", symbol: "cherry", match: "triple", type: "money", amount: 50, locked: false, enabled: true },
    { id: "bar-1", label: "1 bar", symbol: "bar", match: "count", count: 1, type: "money", amount: 25, locked: false, enabled: true },
    { id: "bar-2", label: "2 bar", symbol: "bar", match: "count", count: 2, type: "money", amount: 50, locked: false, enabled: true },
    { id: "bar-3", label: "3 bar", symbol: "bar", match: "triple", type: "money", amount: 100, locked: false, enabled: true },
    { id: "plum-3", label: "3 plums", symbol: "plum", match: "triple", type: "money", amount: 100, locked: false, enabled: true },
    { id: "lemon-3", label: "3 lemons", symbol: "lemon", match: "triple", type: "money", amount: 100, locked: false, enabled: true },
    { id: "grape-3", label: "3 grapes", symbol: "grape", match: "triple", type: "money", amount: 100, locked: false, enabled: true },
    { id: "watermelon-3", label: "3 watermelons", symbol: "watermelon", match: "triple", type: "money", amount: 100, locked: false, enabled: true },
    { id: "orange-3", label: "3 oranges", symbol: "orange", match: "triple", type: "money", amount: 100, locked: false, enabled: true },
    { id: "apple-3", label: "3 apples", symbol: "apple", match: "triple", type: "money", amount: 100, locked: false, enabled: true },
    { id: "clover-3", label: "3 clovers", symbol: "clover", match: "triple", type: "money", amount: 200, locked: false, enabled: true },
    { id: "coin-3", label: "3 coins", symbol: "coin", match: "triple", type: "money", amount: 500, locked: false, enabled: true },
    { id: "diamond-3", label: "3 diamonds", symbol: "diamond", match: "triple", type: "money", amount: 1000, locked: false, enabled: true },
    { id: "seven-3", label: "3 sevens", symbol: "seven", match: "triple", type: "money", amount: 5000, locked: false, enabled: true },
    { id: "mult-2", label: "3 ×2 tiles", symbol: "mult2", match: "triple", type: "signal", amount: 2, locked: true, enabled: true },
    { id: "mult-3", label: "3 ×3 tiles", symbol: "mult3", match: "triple", type: "signal", amount: 3, locked: true, enabled: true },
    { id: "mult-5", label: "3 ×5 tiles", symbol: "mult5", match: "triple", type: "signal", amount: 5, locked: true, enabled: true },
    { id: "mult-10", label: "3 ×10 tiles", symbol: "mult10", match: "triple", type: "signal", amount: 10, locked: true, enabled: true },
    { id: "mult-25", label: "3 ×25 tiles", symbol: "mult25", match: "triple", type: "signal", amount: 25, locked: true, enabled: true },
    { id: "mult-50", label: "3 ×50 tiles", symbol: "mult50", match: "triple", type: "signal", amount: 50, locked: true, enabled: true },
  ];
}

/** @returns {Record<string, boolean>} */
export function defaultSymbols() {
  /** @type {Record<string, boolean>} */
  const map = {};
  SYMBOL_IDS.forEach((id) => {
    map[id] = true;
  });
  return map;
}

/** @param {PayoutRule} rule */
export function formatPayoutValue(rule) {
  if (rule.type === "signal") return `money ×${rule.amount}`;
  if (rule.type === "times") return `×${rule.amount} bet`;
  if (rule.type === "take") return `−$${rule.amount}`;
  return `$${rule.amount}`;
}

/** @param {string[]} colors */
export function machineGradient(colors) {
  const list = colors.length ? colors : DEFAULT_MACHINE_COLORS;
  if (list.length === 1) return list[0];
  return `linear-gradient(160deg, ${list.join(", ")})`;
}
