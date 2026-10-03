// KNOWLEDGE BASE + FORWARD CHAINING (propositional logic).
// Facts are ground propositions such as "Moon(C)". Rules are Horn clauses: IF all premises THEN conclusion.
window.FD = window.FD || {};
(function (FD) {
  const DOORS = ['A', 'B', 'C', 'D'], ROMAN = ['I', 'II', 'III', 'IV'];

  class KnowledgeBase {
    constructor() { this.facts = new Map(); this.rules = []; this.trace = []; }
    addRule(r) { this.rules.push(r); }
    tell(fact, source = 'observed') {            // store a fact (observed in the world, or inferred)
      if (this.facts.has(fact)) return false;
      this.facts.set(fact, source); return true;
    }
    has(f) { return this.facts.has(f); }
    list(source) { return [...this.facts].filter(([, s]) => s === source).map(([f]) => f); }
    reset() { this.facts.clear(); this.trace = []; }

    // FORWARD CHAINING: keep firing rules whose premises are all known until nothing new is derived.
    forwardChain() {
      const fired = []; let changed = true;
      while (changed) {
        changed = false;
        for (const r of this.rules) {
          if (this.has(r.then)) continue;
          if (r.if.every(p => this.has(p))) {     // all premises satisfied -> rule matches
            this.tell(r.then, 'inferred');
            fired.push({ rule: r, derived: r.then });
            changed = true;
          }
        }
      }
      this.trace.push(...fired);
      return fired;                               // the inference trace shown in the AI Agent panel
    }
  }

  const ruleText = r => r.if.join(' ∧ ') + ' → ' + r.then;

  // Rules are written once per door/position (propositional grounding of "Moon(x) → Safe(x)").
  function loadRules(kb) {
    for (const d of DOORS) {
      kb.addRule({ id: 'R1', if: [`Moon(${d})`], then: `Safe(${d})` });
      kb.addRule({ id: 'R2', if: [`Serpent(${d})`], then: `Unsafe(${d})` });
      kb.addRule({ id: 'R3', if: [`Scorched(${d})`], then: `Unsafe(${d})` });
      kb.addRule({ id: 'R4', if: [`Eye(${d})`], then: `Unsafe(${d})` });
      // Goal rule: recommend a door only if it is safe and every other door is unsafe.
      kb.addRule({ id: 'R5', if: [`Safe(${d})`, ...DOORS.filter(x => x !== d).map(x => `Unsafe(${x})`)], then: `Recommend(${d})` });
    }
    // Final chamber: facts carried over from chambers 1-3 decide the exit door.
    for (let p = 1; p <= 4; p++) kb.addRule({ id: 'R6', if: ['LockSolved', `MoonAt(${p})`], then: `ExitDoor(${ROMAN[p - 1]})` });
    for (const r of ROMAN) kb.addRule({ id: 'R7', if: [`ExitDoor(${r})`, 'GuardianEscaped', 'Recommend(C)'], then: `OpenDoor(${r})` });
  }
  FD.ai = { KnowledgeBase, loadRules, ruleText, DOORS, ROMAN };
})(window.FD);
