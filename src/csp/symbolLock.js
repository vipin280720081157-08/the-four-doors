// CONSTRAINT SATISFACTION PROBLEM + BACKTRACKING for the Symbol Lock.
// Variables: the four symbols. Domain: positions 1-4 (all different). Constraints: listed below.
(function (FD) {
  const vars = ['SUN', 'MOON', 'SERPENT', 'EYE'];
  const domain = [1, 2, 3, 4];
  const constraints = [
    { id: 'C1', text: 'Moon must appear before Eye',      vars: ['MOON', 'EYE'],     ok: a => a.MOON < a.EYE },
    { id: 'C2', text: 'Sun cannot be in position 2',      vars: ['SUN'],             ok: a => a.SUN !== 2 },
    { id: 'C3', text: 'Serpent cannot be next to Sun',    vars: ['SERPENT', 'SUN'],  ok: a => Math.abs(a.SERPENT - a.SUN) !== 1 },
    { id: 'C4', text: 'Eye cannot be in position 4',      vars: ['EYE'],             ok: a => a.EYE !== 4 },
    { id: 'C5', text: 'Serpent must appear before Moon',  vars: ['SERPENT', 'MOON'], ok: a => a.SERPENT < a.MOON },
  ];
  // A constraint is checked only once all its variables have values.
  const status = (a, c) => c.vars.every(v => a[v] !== undefined) ? (c.ok(a) ? 'ok' : 'bad') : 'pend';
  const violated = a => constraints.filter(c => status(a, c) === 'bad');

  // BACKTRACKING SEARCH: assign one variable at a time; if a constraint breaks, undo and try the next value.
  function solve() {
    const trace = [], solutions = []; let backtracks = 0;
    function bt(a, i) {
      if (i === vars.length) { solutions.push({ ...a }); trace.push({ t: 'sol' }); return; }
      const v = vars[i];
      for (const val of domain) {
        if (Object.values(a).includes(val)) continue;          // all-different
        a[v] = val;
        const bad = violated(a);
        if (bad.length) { trace.push({ t: 'try', v, val, ok: false, why: bad[0].id }); delete a[v]; backtracks++; continue; }
        trace.push({ t: 'try', v, val, ok: true });
        const before = solutions.length;
        bt(a, i + 1);                                           // recurse to the next variable
        if (solutions.length === before) { trace.push({ t: 'back', v }); backtracks++; }  // dead end -> backtrack
        delete a[v];
      }
    }
    bt({}, 0);
    return { solutions, trace, backtracks };
  }
  FD.csp = { vars, domain, constraints, status, violated, solve };
})(window.FD);
