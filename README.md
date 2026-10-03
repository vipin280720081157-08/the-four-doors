# The Four Doors

*An AI Escape & Reasoning Game*

## Overview
You explore a connected temple of four chambers. An AI Agent observes what you discover and reasons with symbolic AI: logic, constraint solving and heuristic search. There is no machine learning, no external API and no backend. The game runs entirely in the browser.

## AI Concepts
Intelligent agent · agent–environment interaction · knowledge representation · propositional logic · forward chaining · constraint satisfaction · backtracking · heuristic search · A* search · goal-based decision making.

## Game Modules
| Chamber | AI concept | File |
|---|---|---|
| 1. Four Doors | Knowledge base, propositional rules, forward chaining | `src/ai/kb.js` |
| 2. Symbol Lock | CSP + backtracking | `src/csp/symbolLock.js` |
| 3. Guardian | A* with Manhattan heuristic | `src/pathfinding/astar.js` |
| 4. Final Door | Goal-based decision over carried-over facts | rules R6/R7 in `src/ai/kb.js` |

## Architecture
```
Player → Temple Environment → Observation → AI Agent
AI Agent → Knowledge & Logic | CSP + Backtracking | A* Search → AI Decision → Game Action → Environment
```
`src/main.js` is the game engine and UI. The AI Agent panel is rendered from the real outputs of the three algorithm modules.

## Controls
WASD / arrow keys move · E interact · O show/hide AI Agent · P or Esc pause. The Symbol Lock uses the mouse: click a symbol, then a slot.

## How to Run Locally
Double-click `index.html`. (Web fonts need internet; without it, built-in serif and sans fonts are used.) Optionally: `python -m http.server` and open http://localhost:8000.

## How the AI Works
Clues become facts like `Moon(C)`. Rules such as `Moon(C) → Safe(C)` are matched, and forward chaining repeats until no new fact appears. Rule R5 recommends a door only when it is safe and all other doors are unsafe. In the last chamber the lock solution and the escape from the Guardian are added to the same knowledge base, and rules R6 and R7 derive the exit door.

## CSP and Backtracking
Variables: SUN, MOON, SERPENT, EYE. Domain: positions 1–4, all different. Constraints: C1 Moon before Eye · C2 Sun not in position 2 · C3 Serpent not next to Sun · C4 Eye not in position 4 · C5 Serpent before Moon. The solver assigns one symbol at a time, checks constraints, and backtracks on a violation. The puzzle has exactly one solution: Serpent, Moon, Eye, Sun.

## A* Pathfinding
`f(n) = g(n) + h(n)`, where g is steps taken and h is the Manhattan distance `|x1-x2| + |y1-y2|`. The Guardian runs A* every step, toward you when you are within 6 cells, otherwise toward its patrol points. The gold line is the computed path.

## GitHub Pages Deployment
Push to the `main` branch. In the repository go to **Settings → Pages → Source: GitHub Actions**. The workflow in `.github/workflows/deploy.yml` publishes the site.

## Project Structure
```
index.html   README.md   .github/workflows/deploy.yml
src/main.js            game engine + UI
src/ai/kb.js           knowledge base + forward chaining
src/csp/symbolLock.js  CSP + backtracking
src/pathfinding/astar.js  A* search
src/ui/style.css       Dark Editorial Temple theme
```

## Screenshots
Add your five screenshots to `docs/` and list them here.
