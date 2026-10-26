/*
 * RUBICON game engines and solvers, ported from the Python puzzle code
 * (puzzles/{mosaic_grid,chain_vault,tide_grid}/engine.py).
 *
 * Each game exposes the same interface:
 *   prepare(puzzle)        static lookups for one puzzle
 *   initial(g)             starting state
 *   legal(g, s)            legal action names, in the Python enum order
 *   apply(g, s, action)    next state (action must be legal)
 *   won(g, s)
 *   solve(g, s, budget)    {ok: true | false | null, path}; null = out of budget
 *
 * The solvers are exact: unlike the paper's capped A*, they only answer
 * "unsolvable" after exhausting every reachable state (with sound pruning).
 *
 * Plain script (no modules) so the page also works when opened from disk.
 */
(function (root) {
  "use strict";

  const MOVES = { UP: [-1, 0], DOWN: [1, 0], LEFT: [0, -1], RIGHT: [0, 1] };
  const MOVE_ORDER = ["UP", "DOWN", "LEFT", "RIGHT"];
  const OUT_OF_BUDGET = { budget: true };

  function step(g, idx, action) {
    const r = Math.floor(idx / g.w) + MOVES[action][0];
    const c = (idx % g.w) + MOVES[action][1];
    return r < 0 || c < 0 || r >= g.h || c >= g.w ? -1 : r * g.w + c;
  }

  function baseGrid(p) {
    const g = { w: p.w, h: p.h, n: p.w * p.h, wall: new Uint8Array(p.w * p.h) };
    g.idx = (rc) => rc[0] * p.w + rc[1];
    g.rc = (i) => [Math.floor(i / p.w), i % p.w];
    p.walls.forEach((rc) => (g.wall[g.idx(rc)] = 1));
    g.start = g.idx(p.start);
    g.exit = g.idx(p.exit);
    return g;
  }

  function replay(game, g, actions) {
    const states = [game.initial(g)];
    for (const a of actions) states.push(game.apply(g, states[states.length - 1], a));
    return states;
  }

  // Breadth-first search over all reachable states. Returns
  // {ok: true, path} with a shortest winning path, {ok: false} when every
  // reachable state was explored without a win, or {ok: null} if out of budget.
  function breadthFirst(game, g, s, budget) {
    const seen = new Set([game.key(s)]);
    let frontier = [[s, null]];
    let work = 0;
    while (frontier.length) {
      const next = [];
      for (const node of frontier) {
        const [st] = node;
        if (game.won(g, st)) {
          const path = [];
          for (let n = node; n[1]; n = n[1].parent) path.push(n[1].action);
          return { ok: true, path: path.reverse(), work };
        }
        if (++work > budget) return { ok: null, path: null, work };
        for (const a of game.legal(g, st)) {
          const ns = game.apply(g, st, a);
          const k = game.key(ns);
          if (!seen.has(k)) {
            seen.add(k);
            next.push([ns, { parent: node, action: a }]);
          }
        }
      }
      frontier = next;
    }
    return { ok: false, path: null, work };
  }

  // Depth-first search with a dead-state memo and a game-specific prune.
  // Only for games where a state can never repeat along a path (Mosaic paints
  // every tile it leaves; Tide's clock always moves forward).
  function exhaustiveSolve(game, g, s, budget) {
    const dead = new Set();
    const path = [];
    let work = 0;
    function dfs(st) {
      if (game.won(g, st)) return true;
      const k = game.key(st);
      if (dead.has(k)) return false;
      if (++work > budget) throw OUT_OF_BUDGET;
      if (game.hopeless(g, st)) {
        dead.add(k);
        return false;
      }
      const kids = game.legal(g, st).map((a) => [a, game.apply(g, st, a)]);
      kids.sort((x, y) => game.estimate(g, x[1]) - game.estimate(g, y[1]));
      for (const [a, ns] of kids) {
        path.push(a);
        if (dfs(ns)) return true;
        path.pop();
      }
      dead.add(k);
      return false;
    }
    try {
      return dfs(s) ? { ok: true, path: path.slice(), work } : { ok: false, path: null, work };
    } catch (e) {
      if (e === OUT_OF_BUDGET) return { ok: null, path: null, work };
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // Mosaic Grid: every tile the agent leaves is painted and becomes a wall.
  // ---------------------------------------------------------------------------
  const mosaic = {
    name: "Mosaic Grid",
    actions: MOVE_ORDER,
    prepare(p) {
      const g = baseGrid(p);
      g.plateBit = new Int8Array(g.n).fill(-1);
      g.doorAt = new Int8Array(g.n).fill(-1);
      const bit = {};
      p.plates.forEach((pl, i) => {
        bit[pl.id] = i;
        g.plateBit[g.idx(pl.pos)] = i;
      });
      g.doors = p.doors.map((d, i) => {
        g.doorAt[g.idx(d.pos)] = i;
        return { idx: g.idx(d.pos), mask: d.plates.reduce((m, id) => m | (1 << bit[id]), 0), color: d.color };
      });
      g.plates = p.plates;
      g.dist = floorDistances(g);
      g.seen = new Int32Array(g.n);
      g.queue = new Int32Array(g.n);
      g.stamp = 0;
      return g;
    },
    initial(g) {
      return { pos: g.start, lo: 0, hi: 0, act: 0 };
    },
    painted(s, i) {
      return i < 32 ? (s.lo >>> i) & 1 : (s.hi >>> (i - 32)) & 1;
    },
    doorOpen(g, s, d) {
      return (s.act & g.doors[d].mask) === g.doors[d].mask;
    },
    passable(g, s, i) {
      if (i < 0 || g.wall[i] || mosaic.painted(s, i)) return false;
      const d = g.doorAt[i];
      return d < 0 || mosaic.doorOpen(g, s, d);
    },
    legal(g, s) {
      if (s.pos === g.exit) return [];
      return MOVE_ORDER.filter((a) => mosaic.passable(g, s, step(g, s.pos, a)));
    },
    apply(g, s, a) {
      const to = step(g, s.pos, a);
      let { lo, hi, act } = s;
      if (s.pos !== g.exit) {
        if (s.pos < 32) lo = (lo | (1 << s.pos)) >>> 0;
        else hi = (hi | (1 << (s.pos - 32))) >>> 0;
      }
      if (g.plateBit[to] >= 0) act |= 1 << g.plateBit[to];
      return { pos: to, lo, hi, act };
    },
    won(g, s) {
      return s.pos === g.exit;
    },
    key(s) {
      return s.pos + "|" + s.act + "|" + s.lo + "|" + s.hi;
    },
    estimate(g, s) {
      return g.dist[s.pos];
    },
    // Flood fill from the agent over unpainted floor. Closed doors count as
    // open (optimistic) except `blocked`, which counts as a wall.
    reach(g, s, blocked) {
      const stamp = ++g.stamp;
      let head = 0, tail = 0;
      g.queue[tail++] = s.pos;
      g.seen[s.pos] = stamp;
      while (head < tail) {
        const i = g.queue[head++];
        for (const a of MOVE_ORDER) {
          const j = step(g, i, a);
          if (j < 0 || g.seen[j] === stamp || g.wall[j] || mosaic.painted(s, j) || j === blocked) continue;
          g.seen[j] = stamp;
          g.queue[tail++] = j;
        }
      }
      return stamp;
    },
    // Sound prune: the exit must stay reachable, and every closed door that
    // the exit depends on must still have all its missing plates reachable
    // without passing through that door.
    hopeless(g, s) {
      const all = mosaic.reach(g, s, -1);
      if (g.seen[g.exit] !== all) return true;
      for (let d = 0; d < g.doors.length; d++) {
        if (mosaic.doorOpen(g, s, d)) continue;
        const stamp = mosaic.reach(g, s, g.doors[d].idx);
        if (g.seen[g.exit] === stamp) continue;
        for (let p = 0; p < g.plates.length; p++) {
          if (!(g.doors[d].mask & (1 << p)) || s.act & (1 << p)) continue;
          if (g.seen[g.idx(g.plates[p].pos)] !== stamp) return true;
        }
      }
      return false;
    },
    solve(g, s, budget = 2e6) {
      return exhaustiveSolve(mosaic, g, s, budget);
    },
  };

  function floorDistances(g) {
    const dist = new Int32Array(g.n).fill(999);
    const q = [g.exit];
    dist[g.exit] = 0;
    for (let h = 0; h < q.length; h++) {
      for (const a of MOVE_ORDER) {
        const j = step(g, q[h], a);
        if (j >= 0 && !g.wall[j] && dist[j] === 999) {
          dist[j] = dist[q[h]] + 1;
          q.push(j);
        }
      }
    }
    return dist;
  }

  // ---------------------------------------------------------------------------
  // Chain Vault: opening a door uses up keys; the agent stays in place.
  // ---------------------------------------------------------------------------
  const chain = {
    name: "Chain Vault",
    actions: MOVE_ORDER,
    prepare(p) {
      const g = baseGrid(p);
      g.colors = [...new Set([...p.keys.map((k) => k.color), ...p.doors.flatMap((d) => d.req)])].sort();
      const ci = (c) => g.colors.indexOf(c);
      g.keyAt = new Int8Array(g.n).fill(-1);
      g.keys = p.keys.map((k, i) => {
        g.keyAt[g.idx(k.pos)] = i;
        return { idx: g.idx(k.pos), color: ci(k.color) };
      });
      g.doorAt = new Int8Array(g.n).fill(-1);
      g.doors = p.doors.map((d, i) => {
        g.doorAt[g.idx(d.pos)] = i;
        return { idx: g.idx(d.pos), req: d.req.map(ci) };
      });
      return g;
    },
    initial(g) {
      return { pos: g.start, inv: g.colors.map(() => 0), opened: 0, left: (1 << g.keys.length) - 1 };
    },
    hasKeys(s, req) {
      const need = s.inv.slice();
      for (const c of req) if (--need[c] < 0) return false;
      return true;
    },
    // The door an action would open, or -1.
    opens(g, s, a) {
      const t = step(g, s.pos, a);
      if (t < 0) return -1;
      const d = g.doorAt[t];
      if (d < 0 || s.opened & (1 << d) || !chain.hasKeys(s, g.doors[d].req)) return -1;
      return d;
    },
    passable(g, s, i) {
      if (i < 0 || g.wall[i]) return false;
      const d = g.doorAt[i];
      return d < 0 || !!(s.opened & (1 << d));
    },
    legal(g, s) {
      if (s.pos === g.exit) return [];
      return MOVE_ORDER.filter((a) => chain.passable(g, s, step(g, s.pos, a)) || chain.opens(g, s, a) >= 0);
    },
    apply(g, s, a) {
      const d = chain.opens(g, s, a);
      if (d >= 0) {
        const inv = s.inv.slice();
        for (const c of g.doors[d].req) inv[c]--;
        return { pos: s.pos, inv, opened: s.opened | (1 << d), left: s.left };
      }
      const to = step(g, s.pos, a);
      const k = g.keyAt[to];
      if (k >= 0 && s.left & (1 << k)) {
        const inv = s.inv.slice();
        inv[g.keys[k].color]++;
        return { pos: to, inv, opened: s.opened, left: s.left & ~(1 << k) };
      }
      return { pos: to, inv: s.inv, opened: s.opened, left: s.left };
    },
    won(g, s) {
      return s.pos === g.exit;
    },
    key(s) {
      return s.pos + "|" + s.inv.join(",") + "|" + s.opened + "|" + s.left;
    },
    estimate(g, s) {
      const [r, c] = g.rc(s.pos), [er, ec] = g.rc(g.exit);
      return Math.abs(r - er) + Math.abs(c - ec);
    },
    // The agent can walk back and forth, so states repeat: search breadth first.
    solve(g, s, budget = 2e6) {
      return breadthFirst(chain, g, s, budget);
    },
  };

  // ---------------------------------------------------------------------------
  // Tide Grid: tidal zones flood on a schedule; every action costs oxygen.
  // ---------------------------------------------------------------------------
  const tide = {
    name: "Tide Grid",
    actions: [...MOVE_ORDER, "WAIT"],
    prepare(p) {
      const g = baseGrid(p);
      g.zoneAt = new Int8Array(g.n).fill(-1);
      g.zones = p.zones.map((z, i) => {
        z.tiles.forEach((rc) => (g.zoneAt[g.idx(rc)] = i));
        return { id: z.id, dry: z.dry, flood: z.flood, offset: z.offset };
      });
      g.beaconAt = new Int8Array(g.n).fill(-1);
      g.beacons = p.beacons.map((b, i) => {
        g.beaconAt[g.idx(b.pos)] = i;
        return g.idx(b.pos);
      });
      g.all = (1 << g.beacons.length) - 1;
      g.oxygen = p.oxygen;
      return g;
    },
    initial(g) {
      return { pos: g.start, t: 0, got: 0 };
    },
    dry(z, t) {
      return (t + z.offset) % (z.dry + z.flood) < z.dry;
    },
    passableAt(g, i, t) {
      if (i < 0 || g.wall[i]) return false;
      const z = g.zoneAt[i];
      return z < 0 || tide.dry(g.zones[z], t);
    },
    legal(g, s) {
      if (s.t >= g.oxygen || tide.won(g, s)) return [];
      const t = s.t + 1;
      const out = MOVE_ORDER.filter((a) => tide.passableAt(g, step(g, s.pos, a), t));
      if (tide.passableAt(g, s.pos, t)) out.push("WAIT");
      return out;
    },
    apply(g, s, a) {
      const to = a === "WAIT" ? s.pos : step(g, s.pos, a);
      const b = g.beaconAt[to];
      return { pos: to, t: s.t + 1, got: b >= 0 ? s.got | (1 << b) : s.got };
    },
    won(g, s) {
      return s.pos === g.exit && s.got === g.all;
    },
    key(s) {
      return s.pos + "|" + s.t + "|" + s.got;
    },
    // Fewest moves to collect the remaining beacons and reach the exit,
    // ignoring walls and tides (exact over visiting orders, so never too high).
    estimate(g, s) {
      const man = (a, b) => {
        const [r1, c1] = g.rc(a), [r2, c2] = g.rc(b);
        return Math.abs(r1 - r2) + Math.abs(c1 - c2);
      };
      const left = g.beacons.filter((_, i) => !(s.got & (1 << i)));
      let best = Infinity;
      (function tour(at, rest, cost) {
        if (cost >= best) return;
        if (!rest.length) return void (best = Math.min(best, cost + man(at, g.exit)));
        rest.forEach((b, i) => tour(b, rest.filter((_, j) => j !== i), cost + man(at, b)));
      })(s.pos, left, 0);
      return best;
    },
    hopeless(g, s) {
      return g.oxygen - s.t < tide.estimate(g, s);
    },
    solve(g, s, budget = 2e6) {
      return exhaustiveSolve(tide, g, s, budget);
    },
  };

  const games = { mosaic, chain, tide };
  const api = {
    games,
    replay: (key, g, actions) => replay(games[key], g, actions),
    shortestPath: (key, g, s, budget = 3e5) => breadthFirst(games[key], g, s, budget).path,
  };
  root.RubiconEngines = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
