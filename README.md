# casino · roulette

A small, beginner-friendly browser roulette game built step by step. Free to play, no login, ages 6 to 99.

## What it does

- European wheel (single zero) and American wheel (double zero)
- Place straight bets, splits, corners, six-lines, columns, dozens, red/black, even/odd, 1–18, 19–36
- Custom chip denominations from 1 to 5,000 and a betting range from 1 to 99,999,999
- A simple round summary with win, loss, sum, current bet, and total earnings
- Choose between several currency symbols
- Hover any cell or outside bet to see which numbers it covers
- After every spin, the chips stay on the board for 5 seconds so you can see where you bet

## Try it locally

You don't need anything except [Node.js](https://nodejs.org/) installed.

1. Open a terminal in this folder.
2. Run the tiny dev server:

   ```bash
   node dev-server.mjs
   ```

3. Open the printed URL (defaults to `http://127.0.0.1:8787/index.html`).

The server only exists so the browser can load the wheel PDF and font files over `http://` (browsers block local `file://` for that).

## Project files

- `index.html` — the page structure
- `styles.css` — the look (table, summary panel, chips, buttons)
- `roulette.js` — game logic and UI behavior
- `dev-server.mjs` — minimal Node static file server
- `fonts/HelveticaNeue-Bold.otf` — wheel/page font
- `roulette favicon.png` — browser tab icon
- Design assets (`*.png`, `*.pdf`) — original references that the layout follows
- `AGENTS.md` — guide for AI assistants helping with this project

## Built together

This project is built by an adult and a teenager learning to code with help from an AI assistant. The goal isn't just to finish an app — it's to learn how to plan, build, test, and improve in small wins.
