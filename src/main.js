// GAME ENGINE + UI. All reasoning shown in the AI Agent panel comes from FD.ai (kb.js), FD.csp, FD.astar.
(function (FD) {
  const { KnowledgeBase, loadRules, ruleText, DOORS, ROMAN } = FD.ai, { csp, astar } = FD;
  const kb = new KnowledgeBase(); loadRules(kb);
  const W = 19, H = 11, T = 48, DOOR_X = [3, 7, 11, 15];
  const $ = s => document.querySelector(s), cv = $('#cv'), ctx = cv.getContext('2d');
  const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  // ---- symbols (vector paths, used in DOM and canvas) ----
  const SYM = {
    sun: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0',
    moon: 'M17 15.5A7 7 0 1 1 10.5 5a5.5 5.5 0 0 0 6.5 10.5z',
    serpent: 'M7 20c5 0 8-3 4-5s-5-4-1-6 5-3 3-5',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
    scorched: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 3 2 3-4z'
  };
  const svg = (k, s = 40) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${SYM[k]}"/></svg>`;
  function glyph(k, x, y, s, color) {
    ctx.save(); ctx.translate(x - s / 2, y - s / 2); ctx.scale(s / 24, s / 24);
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.stroke(new Path2D(SYM[k])); ctx.restore();
  }

  // ---- maps: # wall, D door, 1-4 clue tablets, 5 altar, S player start, G guardian, X exit ----
  const MAPS = {
    1: ['###D###D###D###D###', '#.................#', '#.1.............2.#', '#.................#', '#....##.....##....#', '#.................#', '#.................#', '#....##.....##....#', '#.3.............4.#', '#........S........#', '###################'],
    3: ['###################', '#S................#', '#.#####.###.#####.#', '#.#.....#.....#...#', '#.#.###.#.###.#.#.#', '#...#....G....#.#.#', '#.#.###.#.###.#.#.#', '#.#.....#.....#...#', '#.#####.###.#####.#', '#................X#', '###################'],
    4: ['###D###D###D###D###', '#.................#', '#.................#', '#....##.....##....#', '#.................#', '#........5........#', '#.................#', '#....##.....##....#', '#.................#', '#........S........#', '###################']
  };
  const CLUES = {
    1: { fact: 'Moon(C)', obs: 'Moon symbol carved above Door C' },
    2: { fact: 'Serpent(A)', obs: 'Serpent coiled over Door A' },
    3: { fact: 'Scorched(B)', obs: 'Door B is cracked and scorched' },
    4: { fact: 'Eye(D)', obs: 'Watching eye engraved on Door D' }
  };
  const THEME = {
    1: { name: 'Four Doors', obj: 'Find the clues, let the AI Agent reason, open the safe door.', bg: '#2a0d13', f1: '#3A1118', f2: '#34101a', wall: '#521C25', edge: '#70404A', glow: '#B9824A', lamps: [[1, 1], [17, 1], [1, 9], [17, 9]] },
    2: { name: 'Symbol Lock', obj: 'Arrange the four symbols so every constraint holds.', bg: '#1f0b0f', f1: '#241A18', f2: '#241A18', wall: '#3a2420', edge: '#B9824A', glow: '#B76552', lamps: [] },
    3: { name: 'Guardian', obj: 'Reach the exit without being caught by the Guardian.', bg: '#1b080c', f1: '#38141c', f2: '#31101a', wall: '#68262f', edge: '#B76552', glow: '#8F3E3E', lamps: [[9, 5]] },
    4: { name: 'Final Door', obj: 'Analyze everything you learned, then open the right door.', bg: '#1e1411', f1: '#2e211d', f2: '#291d19', wall: '#4a3029', edge: '#C7A76A', glow: '#C7A76A', lamps: [[3, 1], [7, 1], [11, 1], [15, 1]] }
  };

  // ---- state ----
  const S = { ch: 0, att: 3, map: null, px: 0, py: 0, held: {}, last: 0, assign: {}, sel: null, g: null, paused: false, modal: false, busy: false, obs: [], fired: [], trace: null, flags: {} };
  const toastEl = $('#toast'); let toastT;
  function toast(m, k = '') { toastEl.textContent = m; toastEl.className = 'show ' + k; clearTimeout(toastT); toastT = setTimeout(() => toastEl.className = '', 3200); }
  function overlay(html) { $('#overlay').innerHTML = `<div class="card">${html}</div>`; $('#overlay').hidden = false; S.modal = true; }
  function closeOverlay() { $('#overlay').hidden = true; S.modal = false; }

  // ---- screens ----
  const SCREENS = {
    intro: () => `<h2>THE FOUR DOORS</h2><p>You have entered an ancient temple containing four mysterious chambers. Discover the clues, solve the symbol lock, avoid the AI Guardian, and reach the final door.</p><ul><li>Explore the temple.</li><li>Collect information.</li><li>Solve the challenges.</li><li>Reach the final door.</li></ul><div class="row"><button class="btn pri" data-act="start">START ADVENTURE</button><button class="btn" data-act="close">BACK</button></div>`,
    how: () => `<h2>HOW TO PLAY</h2><ul><li><b>WASD / Arrow keys</b> move through the temple.</li><li><b>E</b> interacts with clue tablets, doors and the altar when you stand next to them.</li><li><b>O</b> shows or hides the AI Agent panel. <b>P</b> pauses.</li><li>The AI Agent only knows what you discover. Gather clues, then trust its reasoning.</li><li>Each mistake breaks one of your three seals. Lose them all and the chamber restarts.</li></ul><div class="row"><button class="btn" data-act="close">BACK</button></div>`,
    about: () => `<h2>ABOUT THE AI</h2><ul><li><b>Four Doors:</b> knowledge base, propositional rules and forward chaining.</li><li><b>Symbol Lock:</b> constraint satisfaction solved by backtracking.</li><li><b>Guardian:</b> A* heuristic search with Manhattan distance.</li><li><b>Final Door:</b> goal-based decision making over everything learned.</li></ul><p>All reasoning is symbolic and runs in your browser. No machine learning is used.</p><div class="row"><button class="btn" data-act="close">BACK</button></div>`,
    exit: () => `<h2>THE TEMPLE IS SEALED</h2><p>You may now close this tab. The doors will wait for you.</p><div class="row"><button class="btn" data-act="close">RETURN</button></div>`,
    pause: () => `<h2>PAUSED</h2><div class="row"><button class="btn pri" data-act="close">RESUME</button><button class="btn" data-act="menu">MAIN MENU</button></div>`
  };

  // ---- chamber control ----
  const RESET_KB = () => { kb.reset(); S.att = 3; S.flags = {}; };
  function startChamber(n) {
    S.ch = n; S.obs = []; S.fired = []; S.trace = null; S.busy = false; S.paused = false; S.assign = {}; S.sel = null; S.g = null;
    $('#menu').hidden = true; $('#game').hidden = false; closeOverlay(); $('#stage').dataset.ch = n;
    cv.style.animation = 'none'; void cv.offsetWidth; cv.style.animation = '';
    $('#lock').hidden = n !== 2;
    if (n !== 2) loadMap(n);
    if (n === 4) {
      const L = [['Recommend(C)', 'Door clue resolved: Recommend(C)'], ['LockSolved', 'Symbol lock solved'], ['GuardianEscaped', 'Guardian chamber completed']];
      L.forEach(([f, o]) => kb.has(f) && S.obs.push(o));
      const m = [...kb.facts.keys()].find(f => f.startsWith('MoonAt(')); if (m) S.obs.push('Moon sits at position ' + m.slice(7, -1));
    }
    if (n === 2) lockRender();
    $('#objective').textContent = THEME[n].obj; $('#chlabel').textContent = 'CHAMBER 0' + n + ' · ' + THEME[n].name.toUpperCase();
    $('#hud').innerHTML = n === 2 ? '<span><b>Click</b> a symbol, then a slot</span><span><b>Click</b> a filled slot to clear</span><span><b>O</b> AI Agent</span>' : '<span><b>WASD / Arrows</b> Move</span><span><b>E</b> Interact</span><span><b>O</b> AI Agent</span><span><b>P</b> Pause</span>';
    renderHeader(); renderAgent();
    if (n === 1) toast('Explore the room. Stand next to a tablet and press E.');
  }
  function loadMap(n) {
    S.map = MAPS[n].map(r => r.split(''));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = S.map[y][x];
      if (c === 'S') { S.px = x; S.py = y; S.map[y][x] = '.'; }
      if (c === 'G') { S.g = { x, y, t: 0, state: 'patrol', wp: 0, res: null, wps: [{ x: 5, y: 5 }, { x: 13, y: 5 }] }; S.map[y][x] = '.'; }
    }
  }
  function renderHeader() { $('#att').innerHTML = [0, 1, 2].map(i => `<i class="${i < S.att ? '' : 'off'}"></i>`).join(''); }
  function penalty(msg) { S.att--; renderHeader(); toast(msg, 'bad'); if (S.att <= 0) gameOver('Your seals are broken.'); }
  function gameOver(why) {
    S.busy = true;
    overlay(`<h2>${why === 'caught' ? 'GUARDIAN CAUGHT YOU' : 'THE SEALS ARE BROKEN'}</h2><p>${why === 'caught' ? 'The temple remains locked.' : 'The temple resets this chamber.'} What the AI Agent has learned is kept.</p><div class="row"><button class="btn pri" data-act="retry">TRY AGAIN</button><button class="btn" data-act="menu">MAIN MENU</button></div>`);
  }
  function advance(from, msg) { S.busy = true; toast(msg, 'good'); setTimeout(() => startChamber(from + 1), 1100); }

  // ---- interaction ----
  const walk = (x, y) => y >= 0 && y < H && x >= 0 && x < W && '.X'.includes(S.map[y][x]);
  function nearby() {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = S.px + dx, y = S.py + dy, c = S.map[y] && S.map[y][x];
      if (c && 'D12345'.includes(c)) return { c, x, y };
    }
  }
  function interact() {
    if (S.ch === 2 || S.ch === 3) return;
    const n = nearby(); if (!n) return toast('Nothing to interact with here. Move next to a tablet or door.');
    if (n.c === 'D') return openDoor(DOOR_X.indexOf(n.x));
    if (n.c === '5') return analyzeFinal();
    const cl = CLUES[n.c];
    if (kb.has(cl.fact)) return toast('Already in the knowledge base: ' + cl.fact);
    kb.tell(cl.fact); S.obs.push(cl.obs); S.fired.push(...kb.forwardChain());
    toast('Clue recorded: ' + cl.fact); renderAgent();
  }
  function openDoor(i) {
    if (S.ch === 1) {
      const d = DOORS[i];
      if (d !== 'C') return penalty(`Door ${d} (${ROMAN[i]}) is trapped. A seal breaks.`);
      if (!kb.has('Recommend(C)')) return toast('The door will not move. The agent has not yet concluded which door is safe.');
      advance(1, 'Door III (C) opens. The temple accepts your reasoning.');
    } else if (S.ch === 4) {
      const m = [...kb.facts.keys()].find(f => f.startsWith('MoonAt(')), target = ROMAN[+m.slice(7, -1) - 1];
      if (!kb.facts.has('OpenDoor(' + target + ')')) return toast('The door resists. Analyze the final clue first.');
      if (ROMAN[i] !== target) return penalty(`Door ${ROMAN[i]} does not respond. A seal breaks.`);
      S.flags.done = true; victory();
    }
  }
  function analyzeFinal() {
    if (S.ch !== 4) return;
    const f = kb.forwardChain(); S.fired.push(...f);
    toast(f.length ? 'Final analysis complete.' : 'Analysis already complete.'); renderAgent();
  }
  function victory() {
    S.busy = true;
    const T8 = ['Intelligent Agent', 'Knowledge Representation', 'Propositional Logic', 'Forward Chaining', 'Constraint Satisfaction', 'Backtracking', 'A* Search', 'Goal-Based Decision Making'];
    overlay(`<h2>THE TEMPLE HAS ACCEPTED YOUR ANSWER</h2><p style="font:600 24px var(--serif);color:var(--ivory)">THE FOUR DOORS — ESCAPED</p><p>AI reasoning complete.</p><ul class="tick">${T8.map(t => `<li>${t}</li>`).join('')}</ul><div class="row"><button class="btn pri" data-act="again">RETURN TO TEMPLE</button><button class="btn" data-act="menu">MAIN MENU</button></div>`);
  }

  // ---- symbol lock ----
  const byPos = p => Object.keys(S.assign).find(k => S.assign[k] === p);
  function lockRender() {
    const a = S.assign, mark = { ok: '✓', bad: '✗', pend: '○' };
    $('#lock').innerHTML = `<div class="lockbox"><h2>SYMBOL LOCK</h2><p class="sub">Each symbol takes exactly one position.</p>
      <div><div class="slots">${[1, 2, 3, 4].map(p => { const s = byPos(p); return `<button class="slot ${s ? 'filled' : ''}" data-act="slot" data-v="${p}"><i>${p}</i>${s ? svg(s.toLowerCase(), 44) + '<b>' + s + '</b>' : '<b>?</b>'}</button>`; }).join('')}</div>
      <div class="tiles">${csp.vars.map(s => `<button class="tile ${S.sel === s ? 'sel' : ''} ${a[s] ? 'used' : ''}" data-act="tile" data-v="${s}">${svg(s.toLowerCase(), 32)}<b>${s}</b></button>`).join('')}</div></div>
      <div><h3>CONSTRAINTS</h3><ul class="cons">${csp.constraints.map(c => { const st = csp.status(a, c); return `<li class="${st}"><span>${mark[st]}</span>${c.text}</li>`; }).join('')}</ul></div>
      <div class="row"><button class="btn" data-act="clear">CLEAR</button><button class="btn pri" data-act="check">CHECK ARRANGEMENT</button></div></div>`;
    renderAgent(false);
  }
  function lockClick(act, v) {
    const a = S.assign;
    if (act === 'tile') S.sel = S.sel === v ? null : v;
    if (act === 'slot') {
      const p = +v, occ = byPos(p);
      if (S.sel) { delete a[S.sel]; if (occ) delete a[occ]; a[S.sel] = p; S.sel = null; } else if (occ) delete a[occ];
    }
    if (act === 'clear') { S.assign = {}; S.sel = null; }
    lockRender();
  }
  function lockCheck() {
    const a = S.assign;
    if (Object.keys(a).length < 4) return toast('Place all four symbols first.');
    const bad = csp.violated(a);
    if (bad.length) return penalty('The lock rejects it: ' + bad.map(c => c.id).join(', ') + ' violated. A seal breaks.');
    kb.tell('LockSolved'); kb.tell('MoonAt(' + a.MOON + ')'); S.fired.push(...kb.forwardChain()); S.flags.csp = true;
    overlay(`<h2>SYMBOL LOCK SOLVED</h2><p>Valid arrangement found: ${csp.vars.slice().sort((x, y) => a[x] - a[y]).join(' · ')}.</p><div class="row"><button class="btn pri" data-act="next3">CONTINUE</button></div>`);
  }

  // ---- AI agent panel ----
  function decide() {
    const f = [...kb.facts.keys()];
    if (S.ch === 1) { const r = f.find(x => x.startsWith('Recommend(')); return r ? `Open Door ${r[10]} (${ROMAN[DOORS.indexOf(r[10])]})` : 'Not enough knowledge. Gather more clues.'; }
    if (S.ch === 4) { const r = f.find(x => x.startsWith('OpenDoor(')); return r ? 'Open Door ' + r.slice(9, -1) : 'Press ANALYZE FINAL CLUE to reason over what was learned.'; }
  }
  function renderAgent(anim = true) {
    let i = 0;
    const sec = (t, b, c = '') => `<section class="${anim ? 'step ' : ''}${c}" style="animation-delay:${anim ? i++ * 90 : 0}ms"><h4>${t}</h4>${b}</section>`;
    const li = a => a.length ? '<ul>' + a.map(x => `<li>${x}</li>`).join('') + '</ul>' : '<p class="dim">none yet</p>';
    let h = `<p class="title">AI AGENT</p>` + sec('CURRENT STATE', `<p><span class="pill"></span>Chamber 0${S.ch} · ${THEME[S.ch].name}</p>`);
    if (S.ch === 1 || S.ch === 4) {
      h += sec('OBSERVATIONS', li(S.obs.map(o => '✓ ' + o)));
      h += sec('KNOWLEDGE BASE', li(kb.list('observed').map(f => `<code>${f}</code>`)));
      h += sec('RULE MATCH', li(S.fired.map(f => `<code>${f.rule.id}: ${ruleText(f.rule)}</code>`)), 'gold');
      h += sec('INFERENCE', li(S.fired.map(f => `<code>${f.derived}</code>`)), 'gold');
      h += sec('DECISION', `<p class="dec">→ ${decide()}</p>` + (S.ch === 4 ? '<button class="btn small pri" data-act="final">ANALYZE FINAL CLUE</button>' : ''));
    } else if (S.ch === 2) {
      const a = S.assign, bad = csp.violated(a), full = Object.keys(a).length === 4;
      h += sec('CSP MODEL', `<p><b>Variables:</b> ${csp.vars.join(', ')}</p><p><b>Domain:</b> positions {1,2,3,4}, all different</p><p><b>Constraints:</b> ${csp.constraints.length}</p>`);
      h += sec('CURRENT ASSIGNMENT', li(csp.vars.map(v => `<code>${v} = ${a[v] || 'unassigned'}</code>`)));
      h += sec('CONSTRAINT CHECK', li(csp.constraints.map(c => `${{ ok: '✓', bad: '✗', pend: '○' }[csp.status(a, c)]} ${c.id}`)));
      let b = '<button class="btn small" data-act="analyze">RUN BACKTRACKING SEARCH</button>';
      if (S.trace) {
        const T2 = S.trace, lines = T2.trace.slice(0, 14).map(e => e.t === 'try' ? `<li class="${e.ok ? 't-ok' : 't-bad'}"><code>${e.v} = ${e.val} ${e.ok ? '✓' : '✗ ' + e.why}</code></li>` : e.t === 'back' ? `<li class="t-back"><code>↩ backtrack from ${e.v}</code></li>` : '<li class="t-ok"><code>solution found</code></li>');
        b += `<p>Steps: ${T2.trace.length} · Backtracks: ${T2.backtracks} · Solutions: ${T2.solutions.length}</p><ul>${lines.join('')}</ul><p class="dim">First 14 steps shown.</p>`;
      }
      h += sec('BACKTRACKING ANALYSIS', b, 'gold');
      h += sec('DECISION', `<p class="dec">${bad.length ? 'Violation: ' + bad[0].text : full ? 'Assignment satisfies all constraints.' : 'Waiting for a complete arrangement.'}</p>`);
    } else if (S.ch === 3 && S.g) {
      const g = S.g, r = g.res, n = r && r.path && (r.path[1] || r.path[0]), chase = g.state === 'chase', d = man(g, { x: S.px, y: S.py });
      h += sec('OBSERVATIONS', `<p>Player at (${S.px}, ${S.py}) · distance ${d}</p><p class="${chase ? 'warn' : ''}">${chase ? 'PLAYER DETECTED' : 'No player in range (detect ≤ 6)'}</p>`);
      h += sec(chase ? 'A* SEARCH ACTIVE' : 'A* SEARCH (PATROL)', `<p>f(n) = g(n) + h(n)</p><p>Heuristic: Manhattan distance</p>` + (n ? `<p>Next node: (${n.x}, ${n.y})</p><p>g(n): ${n.g}</p><p>h(n): ${n.h}</p><p>f(n): ${n.f}</p><p>Path nodes: ${r.path.length}</p><p>Nodes expanded: ${r.expanded}</p>` : '<p class="dim">No path yet.</p>'), 'gold');
      h += sec('DECISION', `<p class="dec">${chase ? '→ Follow the A* path toward the player' : '→ Walk the patrol route'}</p>`);
    }
    $('#agent').innerHTML = h;
  }

  // ---- guardian AI ----
  function guardianTick(dt) {
    const g = S.g, p = { x: S.px, y: S.py }, d = man(g, p);
    if (d <= 6) g.state = 'chase'; else if (d > 9) g.state = 'patrol';       // hysteresis
    g.t += dt;
    if (g.t < (g.state === 'chase' ? 300 : 450)) return;
    g.t = 0;
    let target = g.state === 'chase' ? p : g.wps[g.wp];
    if (g.state === 'patrol' && g.x === target.x && g.y === target.y) { g.wp = (g.wp + 1) % g.wps.length; target = g.wps[g.wp]; }
    g.res = astar(walk, g, target);                                         // A* from Guardian to target
    if (g.res.path && g.res.path.length > 1) { g.x = g.res.path[1].x; g.y = g.res.path[1].y; }
    if (man(g, p) <= 1) return gameOver('caught');
    renderAgent(false);
  }

  // ---- input & loop ----
  const KEYS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); if (!S.ch) return;
    if (KEYS[k]) { S.held[k] = true; e.preventDefault(); }
    if (k === 'e') interact();
    if (k === 'o') $('#agent').hidden = !$('#agent').hidden;
    if ((k === 'p' || k === 'escape') && !S.busy) { if (S.modal) closeOverlay(); else { S.paused = true; overlay(SCREENS.pause()); } }
  });
  addEventListener('keyup', e => delete S.held[e.key.toLowerCase()]);
  function step(t) {
    if (t - S.last < 120) return;
    const k = Object.keys(S.held).find(x => KEYS[x]); if (!k) return;
    const nx = S.px + KEYS[k][0], ny = S.py + KEYS[k][1];
    if (!walk(nx, ny)) return;
    S.px = nx; S.py = ny; S.last = t;
    if (S.ch === 3) { renderAgent(false); if (S.map[ny][nx] === 'X') { kb.tell('GuardianEscaped'); S.fired.push(...kb.forwardChain()); S.flags.astar = true; advance(3, 'You slip through the exit. The Guardian loses you.'); } }
  }
  let lt = 0;
  function loop(t) {
    const dt = t - lt; lt = t;
    if (S.ch && !S.modal && !S.paused && !S.busy && S.ch !== 2) { step(t); if (S.ch === 3 && S.g) guardianTick(Math.min(dt, 100)); }
    if (S.ch) draw();
    requestAnimationFrame(loop);
  }

  // ---- drawing ----
  function draw() {
    const th = THEME[S.ch]; ctx.fillStyle = th.bg; ctx.fillRect(0, 0, cv.width, cv.height);
    if (S.ch !== 2) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = S.map[y][x], px = x * T, py = y * T;
        if (c === '#' || c === 'D') { ctx.fillStyle = th.wall; ctx.fillRect(px, py, T, T); ctx.strokeStyle = th.edge; ctx.globalAlpha = .5; ctx.strokeRect(px + .5, py + .5, T - 1, T - 1); ctx.globalAlpha = 1; }
        else { ctx.fillStyle = (x + y) % 2 ? th.f1 : th.f2; ctx.fillRect(px, py, T, T); }
        if (c === 'D') drawDoor(x, y);
        if ('12345X'.includes(c)) drawObj(c, px, py);
      }
      for (const [lx, ly] of th.lamps) { const r = ctx.createRadialGradient(lx * T + 24, ly * T + 24, 4, lx * T + 24, ly * T + 24, 150); r.addColorStop(0, th.glow + '33'); r.addColorStop(1, th.glow + '00'); ctx.fillStyle = r; ctx.fillRect(0, 0, cv.width, cv.height); }
      if (S.ch === 3 && S.g) drawGuardian();
      const cx = S.px * T + 24, cy = S.py * T + 24;
      ctx.fillStyle = '#F4E9DC'; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill(); ctx.strokeStyle = '#B76552'; ctx.lineWidth = 3; ctx.stroke();
      const n = (S.ch === 1 || S.ch === 4) && nearby(); if (n) { ctx.strokeStyle = '#C7A76A'; ctx.lineWidth = 2; ctx.strokeRect(n.x * T + 3, n.y * T + 3, T - 6, T - 6); }
    }
    const v = ctx.createRadialGradient(456, 264, 200, 456, 264, 560); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.34)'); ctx.fillStyle = v; ctx.fillRect(0, 0, cv.width, cv.height);
  }
  function drawDoor(x, y) {
    const px = x * T, i = DOOR_X.indexOf(x), th = THEME[S.ch];
    ctx.fillStyle = '#150d0c'; ctx.fillRect(px + 4, y * T + 6, T - 8, T - 6); ctx.strokeStyle = th.edge; ctx.lineWidth = 2; ctx.strokeRect(px + 4, y * T + 6, T - 8, T - 6);
    ctx.fillStyle = '#F4E9DC'; ctx.font = '600 15px "Cormorant Garamond",Georgia,serif'; ctx.textAlign = 'center';
    ctx.fillText(ROMAN[i], px + 24, y * T + 40);
    if (S.ch === 1) { const k = { A: 'serpent', B: 'scorched', C: 'moon', D: 'eye' }[DOORS[i]], f = { A: 'Serpent(A)', B: 'Scorched(B)', C: 'Moon(C)', D: 'Eye(D)' }[DOORS[i]]; if (kb.has(f)) glyph(k, px + 24, y * T + 22, 22, '#C7A76A'); else { ctx.fillStyle = '#CDB9A7'; ctx.fillText(DOORS[i], px + 24, y * T + 24); } }
  }
  function drawObj(c, px, py) {
    if (c === 'X') { ctx.strokeStyle = '#C7A76A'; ctx.lineWidth = 3; ctx.strokeRect(px + 6, py + 6, T - 12, T - 12); ctx.fillStyle = 'rgba(199,167,106,.18)'; ctx.fillRect(px + 6, py + 6, T - 12, T - 12); return; }
    const done = c !== '5' && kb.has(CLUES[c].fact);
    ctx.fillStyle = '#CDB9A7'; ctx.fillRect(px + 10, py + 8, T - 20, T - 16); ctx.strokeStyle = done ? '#788B6A' : '#B76552'; ctx.lineWidth = 3; ctx.strokeRect(px + 10, py + 8, T - 20, T - 16);
    glyph(c === '5' ? 'eye' : 'scorched', px + 24, py + 24, 14, '#3A1118');
  }
  function drawGuardian() {
    const g = S.g, cx = g.x * T + 24, cy = g.y * T + 24, res = g.res;
    if (res) {
      ctx.fillStyle = 'rgba(183,101,82,.14)'; res.closed.forEach(k => { const [x, y] = k.split(',').map(Number); ctx.fillRect(x * T + 14, y * T + 14, 20, 20); });
      if (res.path && g.state === 'chase') {
        ctx.strokeStyle = '#C7A76A'; ctx.lineWidth = 3; ctx.beginPath(); res.path.forEach((n, i) => i ? ctx.lineTo(n.x * T + 24, n.y * T + 24) : ctx.moveTo(n.x * T + 24, n.y * T + 24)); ctx.stroke();
        ctx.fillStyle = '#C7A76A'; res.path.forEach(n => { ctx.beginPath(); ctx.arc(n.x * T + 24, n.y * T + 24, 4, 0, 7); ctx.fill(); });
      }
    }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#8F3E3E'; ctx.fillRect(-13, -13, 26, 26); ctx.strokeStyle = '#CDB9A7'; ctx.lineWidth = 2; ctx.strokeRect(-13, -13, 26, 26); ctx.restore();
    ctx.fillStyle = '#C7A76A'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
  }

  // ---- actions & events ----
  function seed(n) {
    if (n >= 2) { ['Moon(C)', 'Serpent(A)', 'Scorched(B)', 'Eye(D)'].forEach(f => kb.tell(f)); kb.forwardChain(); }
    if (n >= 3) { const s = csp.solve().solutions[0]; kb.tell('LockSolved'); kb.tell('MoonAt(' + s.MOON + ')'); kb.forwardChain(); }
    if (n >= 4) kb.tell('GuardianEscaped');
  }
  const ACTS = {
    intro: () => overlay(SCREENS.intro()), how: () => overlay(SCREENS.how()), about: () => overlay(SCREENS.about()), exit: () => overlay(SCREENS.exit()),
    close: () => { closeOverlay(); S.paused = false; },
    start: () => { RESET_KB(); startChamber(1); },
    menu: () => { S.ch = 0; closeOverlay(); $('#game').hidden = true; $('#menu').hidden = false; },
    retry: () => { S.att = 3; startChamber(S.ch); },
    again: () => { RESET_KB(); startChamber(1); },
    next3: () => startChamber(3), final: analyzeFinal,
    analyze: () => { S.trace = csp.solve(); S.flags.analysis = true; renderAgent(false); },
    check: lockCheck
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (['tile', 'slot', 'clear'].includes(a)) return lockClick(a, b.dataset.v);
    if (ACTS[a]) ACTS[a]();
  });
  // Screenshot helper: open index.html#ch2, #ch3 or #ch4 to jump to a chamber with earlier knowledge filled in.
  const m = location.hash.match(/^#ch([1-4])$/);
  if (m) { RESET_KB(); seed(+m[1]); startChamber(+m[1]); }
  requestAnimationFrame(loop);
})(window.FD);
