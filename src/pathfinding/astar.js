// A* SEARCH on a 4-connected grid.  f(n) = g(n) + h(n),  h = Manhattan distance.
(function (FD) {
  FD.astar = function (walk, start, goal) {
    const key = (x, y) => x + ',' + y;
    const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);   // admissible heuristic
    const open = [{ x: start.x, y: start.y, g: 0, h: h(start.x, start.y), f: h(start.x, start.y), parent: null }];
    const bestG = new Map([[key(start.x, start.y), 0]]), closed = new Set();
    while (open.length) {
      open.sort((a, b) => a.f - b.f || a.h - b.h);          // pick the node with the lowest f(n)
      const n = open.shift(), k = key(n.x, n.y);
      if (closed.has(k)) continue;
      closed.add(k);
      if (n.x === goal.x && n.y === goal.y) {                // goal reached: rebuild path via parents
        const path = []; for (let c = n; c; c = c.parent) path.unshift(c);
        return { path, closed, expanded: closed.size };
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = n.x + dx, y = n.y + dy;
        if (!walk(x, y)) continue;                           // obstacles are respected
        const g = n.g + 1, nk = key(x, y);
        if (bestG.has(nk) && bestG.get(nk) <= g) continue;
        bestG.set(nk, g);
        open.push({ x, y, g, h: h(x, y), f: g + h(x, y), parent: n });
      }
    }
    return { path: null, closed, expanded: closed.size };
  };
})(window.FD);
