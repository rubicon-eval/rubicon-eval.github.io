/*
 * The playable puzzles and the "be the model" quiz, plus small helpers that
 * the story layer (story.js) shares.
 */
(function (root) {
  "use strict";
  const E = root.RubiconEngines;
  const B = root.RubiconBoard;
  const R = root.RUBICON_RESULTS;
  const DATA = root.RUBICON_DATA;
  const CHECKS = root.RUBICON_CHECKS || {};
  const KEYS = ["mosaic", "chain", "tide"];
  const ARROW = { UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→", WAIT: "W" };
  const WORD = { UP: "up", DOWN: "down", LEFT: "left", RIGHT: "right", WAIT: "wait" };
  const $ = (id) => document.getElementById(id);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const checked = (key, p) => (CHECKS[key] && CHECKS[key][p.id]) || null;
  // Exact solvability after each RQ3 move (falls back to the stored labels).
  function rq3Solv(key, p) {
    const c = checked(key, p);
    return c ? [...c.solv].map((v) => v === "1") : p.rq3.solvPy;
  }
  const goodPuzzles = (key) => DATA[key].puzzles.filter((p) => !checked(key, p) || checked(key, p).ok);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  function chip(action, i, cls = "", tag = "span") {
    const c = el(tag, "chip " + cls);
    c.appendChild(document.createTextNode(ARROW[action]));
    if (i !== undefined) c.appendChild(el("span", "n", String(i + 1)));
    c.title = `Move ${i + 1}: ${action}`;
    return c;
  }
  function setLamp(lamp, kind, label) {
    lamp.classList.remove("dead", "unknown", "won", "hidden-state");
    if (kind !== "ok") lamp.classList.add(kind);
    lamp.querySelector(".lamp-text").textContent = label;
  }

  // ---------------------------------------------------------------------------
  // Shared side panels
  // ---------------------------------------------------------------------------
  function hud(box, key, g, p, s) {
    box.replaceChildren();
    if (key === "mosaic") {
      g.doors.forEach((d) => {
        const plates = p.plates.filter((pl) => pl.color === d.color);
        const on = plates.filter((pl) => s.act & (1 << p.plates.indexOf(pl))).length;
        const pill = el("span", "pill");
        const sw = el("span", "sw");
        sw.style.background = B.colors.LINK[d.color].icon;
        pill.append(sw, document.createTextNode(`${d.color} door: ${on}/${plates.length} plates`));
        box.appendChild(pill);
      });
    } else if (key === "chain") {
      const pill = el("span", "pill", "Keys held: ");
      const held = g.colors.filter((c, i) => s.inv[i] > 0);
      if (!held.length) pill.appendChild(document.createTextNode("none"));
      held.forEach((c) => {
        const sw = el("span", "sw");
        sw.style.background = (B.colors.KEY[c] || B.colors.KEY.red).icon;
        pill.append(sw, document.createTextNode(` ${c} × ${s.inv[g.colors.indexOf(c)]}  `));
      });
      box.appendChild(pill);
      const left = p.doors.filter((d, i) => !(s.opened & (1 << i))).length;
      box.appendChild(el("span", "pill", `Locked doors: ${left}`));
    } else {
      const left = g.oxygen - s.t;
      const ox = el("span", "oxygen" + (left <= 3 ? " low" : ""));
      const bar = el("span", "bar");
      const fill = el("i");
      fill.style.width = (100 * left) / g.oxygen + "%";
      bar.appendChild(fill);
      ox.append(document.createTextNode("Oxygen"), bar, document.createTextNode(`${left}/${g.oxygen}`));
      box.appendChild(ox);
      const got = g.beacons.filter((_, i) => s.got & (1 << i)).length;
      box.appendChild(el("span", "pill", `Beacons: ${got}/${g.beacons.length}`));
      const sched = el("div", "tide-sched");
      g.zones.forEach((z) => {
        const row = el("div", "z");
        row.appendChild(el("span", null, `Zone ${z.id}`));
        for (let t = s.t; t < s.t + 12; t++) {
          const c = el("span", "t" + (t === s.t ? " now" : ""));
          c.style.background = E.games.tide.dry(z, t) ? "#D4A574" : "#2471A3";
          c.title = `t=${t}: ${E.games.tide.dry(z, t) ? "dry" : "flooded"}`;
          row.appendChild(c);
        }
        sched.appendChild(row);
      });
      sched.title = "Tide schedule from now (outlined) for the next 12 turns. Tan = dry, blue = flooded.";
      box.appendChild(sched);
    }
  }
  function fullPrompt(key, p, task) {
    const d = DATA[key];
    const t = p.tasks[task];
    const rules = d.rules[d.rulesFor[task]];
    return rules + (t.startsWith("## Task") ? p.instance + t : t);
  }
  function minibars(box, title, rows) {
    box.appendChild(el("p", "minibars-title", title));
    const mb = el("div", "minibars");
    rows.sort((a, b) => b[1] - a[1]).forEach(([name, v]) => {
      const r = el("div", "mb");
      const track = el("span", "track");
      const bar = el("i");
      bar.style.width = v + "%";
      track.appendChild(bar);
      r.append(el("span", null, name), track, el("span", null, v + "%"));
      mb.appendChild(r);
    });
    box.appendChild(mb);
  }

  // ---------------------------------------------------------------------------
  // Play
  // ---------------------------------------------------------------------------
  function playApp() {
    const app = $("play-app");
    const S = { key: "mosaic", p: null, g: null, states: [], acts: [], solv: [], over: null, oracle: false, busy: false };
    const tabs = $("play-tabs");
    KEYS.forEach((key) => {
      const t = el("button", "tab");
      t.setAttribute("role", "tab");
      t.dataset.key = key;
      const sw = el("span", "swatch");
      sw.style.background = { mosaic: "#5DADE2", chain: "#F1948A", tide: "#D4A574" }[key];
      t.append(sw, document.createTextNode(R.games[key].name));
      t.addEventListener("click", () => load(key));
      tabs.appendChild(t);
    });
    const game = () => E.games[S.key];
    const cur = () => S.states[S.states.length - 1];

    function load(key, puzzle) {
      S.key = key;
      S.p = puzzle || pick(goodPuzzles(key));
      S.g = game().prepare(S.p);
      [...tabs.children].forEach((t) => t.setAttribute("aria-selected", t.dataset.key === key));
      restart();
      const info = R.games[key];
      const rules = $("play-rules");
      rules.replaceChildren(el("h4", null, info.name));
      const dl = el("dl");
      [["Goal", info.goal], ["Irreversible rule", info.rule], ["Layout", `${S.p.w}×${S.p.h}, ${S.p.template.replace(/_/g, " ")}: ${R.templates[key][S.p.template] || ""}`]].forEach(([t, d]) => dl.append(el("dt", null, t), el("dd", null, d)));
      rules.appendChild(dl);
      $("play-name").textContent = S.p.id;
      $("play-img").src = `assets/img/${key}/${S.p.id}.webp`;
      $("play-prompt").textContent = fullPrompt(key, S.p, "rq2_hard_deadlock");
      buildPad();
    }
    function restart() {
      S.states = [game().initial(S.g)];
      S.acts = [];
      S.solv = [true];
      S.over = null;
      render();
    }
    function buildPad() {
      const pad = $("play-pad");
      pad.replaceChildren();
      game().actions.forEach((a) => {
        const b = el("button", a.toLowerCase(), ARROW[a] === "W" ? "WAIT" : ARROW[a]);
        b.setAttribute("aria-label", a);
        b.dataset.action = a;
        b.addEventListener("click", () => move(a));
        pad.appendChild(b);
      });
    }
    function checkSolv(i, sync) {
      if (S.solv[i] !== undefined) return;
      const run = () => {
        if (S.solv[i] !== undefined || !S.states[i]) return;
        const r = game().solve(S.g, S.states[i], 3e6);
        S.solv[i] = r.ok;
        render();
      };
      if (sync) run();
      else setTimeout(run, 30);
    }
    function move(a) {
      if (S.over || S.busy) return;
      const s = cur();
      if (!game().legal(S.g, s).includes(a)) {
        const b = $("play-board");
        b.classList.remove("shake");
        void b.getBoundingClientRect();
        b.classList.add("shake");
        return;
      }
      S.states.push(game().apply(S.g, s, a));
      S.acts.push(a);
      S.solv.length = S.states.length - 1;
      const ns = cur();
      if (game().won(S.g, ns)) {
        S.solv[S.states.length - 1] = true;
        S.over = "won";
      } else if (!game().legal(S.g, ns).length) {
        S.solv[S.states.length - 1] = false;
        S.over = "stuck";
      }
      checkSolv(S.states.length - 1);
      render();
    }
    // First move after which the puzzle could not be won, if every state is known.
    function fatalMove() {
      for (let i = 1; i < S.states.length; i++) {
        checkSolv(i, true);
        if (S.solv[i] === false) return i;
      }
      return 0;
    }
    function declare() {
      if (S.over || S.busy) return;
      const last = S.states.length - 1;
      checkSolv(last, true);
      S.over = S.solv[last] === false ? "declared-right" : S.solv[last] === true ? "declared-wrong" : "declared-unknown";
      render();
    }
    function showWay() {
      const r = game().solve(S.g, cur(), 3e6);
      const path = E.shortestPath(S.key, S.g, cur(), 4e5) || r.path;
      if (!path) return;
      S.over = null;
      S.busy = true;
      render();
      let k = 0;
      const stepOnce = () => {
        if (k >= path.length) {
          S.busy = false;
          render();
          return;
        }
        S.busy = false;
        move(path[k++]);
        S.busy = true;
        setTimeout(stepOnce, 330);
      };
      stepOnce();
    }

    function render() {
      const s = cur();
      const reveal = S.oracle || (S.over && S.over !== "declared-wrong");
      B.draw($("play-board"), S.key, S.g, S.p, s);
      hud($("play-hud"), S.key, S.g, S.p, s);
      const legal = game().legal(S.g, s);
      [...$("play-pad").children].forEach((b) => (b.disabled = !!S.over || S.busy || !legal.includes(b.dataset.action)));
      $("play-undo").disabled = S.acts.length === 0 || S.busy;
      $("play-declare").disabled = !!S.over || S.busy;

      const lamp = $("play-lamp");
      lamp.hidden = !S.oracle;
      const now = S.solv[S.states.length - 1];
      if (game().won(S.g, s)) setLamp(lamp, "won", "Solved");
      else if (now === undefined || now === null) setLamp(lamp, "unknown", now === null ? "Too hard to check" : "Checking…");
      else setLamp(lamp, now ? "ok" : "dead", now ? "Still winnable" : "Can't be won anymore");

      let fatal = 0;
      if (reveal) for (let i = 1; i < S.states.length; i++) if (S.solv[i] === false) { fatal = i; break; }
      const tl = $("play-timeline");
      tl.replaceChildren(...S.acts.map((a, k) => {
        const v = S.solv[k + 1];
        let cls = "";
        if (reveal && v !== undefined && v !== null) cls = v ? "is-safe" : k + 1 === fatal ? "is-fatal" : "is-dead";
        return chip(a, k, cls + (k === S.acts.length - 1 ? " is-current" : ""));
      }));
      if (!S.acts.length) tl.appendChild(el("span", "moves-note", "No moves yet."));
      overlay();
    }

    function overlay() {
      const box = $("play-overlay");
      if (!S.over || S.busy) {
        box.hidden = true;
        return;
      }
      const msg = el("div", "msg");
      const row = el("div", "row");
      const button = (label, fn, cls = "btn btn-sm") => {
        const b = el("button", cls, label);
        b.addEventListener("click", fn);
        row.appendChild(b);
      };
      const n = S.acts.length;
      let tone = "good";
      if (S.over === "won") {
        msg.append(el("h4", null, "You made it!"), el("p", null, `Solved in ${plural(n, "move")}.`));
        button("New puzzle", () => load(S.key), "btn btn-sm btn-primary");
      } else {
        const f = fatalMove();
        const fa = f ? S.acts[f - 1] : null;
        if (S.over === "stuck") {
          tone = "bad";
          const out = S.key === "tide" && cur().t >= S.g.oxygen;
          msg.append(el("h4", null, out ? "Out of oxygen" : "Stuck"));
          msg.append(el("p", null, f ? `The puzzle became impossible at move ${f} (${WORD[fa]}), ${plural(n - f, "move")} before you got stuck.` : "No legal moves are left."));
        } else if (S.over === "declared-right") {
          msg.append(el("h4", null, "Correct, it can't be won"));
          msg.append(el("p", null, f === n ? `It became impossible with your last move (${WORD[fa]}). You noticed right away.` : `It became impossible at move ${f} (${WORD[fa]}). You noticed ${plural(n - f, "move")} later.`));
        } else if (S.over === "declared-wrong") {
          tone = "bad";
          msg.append(el("h4", null, "Not yet!"), el("p", null, "This puzzle can still be won from here. Want to see how?"));
          button("Show me a way", showWay, "btn btn-sm btn-primary");
          button("Keep playing", () => { S.over = null; render(); });
        } else {
          msg.append(el("h4", null, "Hard to say"), el("p", null, "This state is too big to check quickly in the browser."));
          button("Keep playing", () => { S.over = null; render(); });
        }
        if (S.over !== "declared-wrong" && S.over !== "declared-unknown") {
          if (f) button(`Undo to before move ${f}`, () => { S.states.length = f; S.acts.length = f - 1; S.solv.length = f; S.over = null; render(); });
          button("Try again", restart);
          button("New puzzle", () => load(S.key), "btn btn-sm btn-primary");
        }
      }
      msg.appendChild(row);
      box.className = "overlay " + tone;
      box.replaceChildren(msg);
      box.hidden = false;
    }

    $("play-undo").addEventListener("click", () => {
      if (!S.acts.length) return;
      S.states.pop();
      S.acts.pop();
      S.solv.length = S.states.length;
      S.over = null;
      render();
    });
    $("play-restart").addEventListener("click", restart);
    $("play-new").addEventListener("click", () => load(S.key));
    $("play-declare").addEventListener("click", declare);
    $("play-oracle").addEventListener("change", (e) => {
      S.oracle = e.target.checked;
      for (let i = 1; i < S.states.length; i++) checkSolv(i);
      render();
    });
    const KEYMAP = { ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT", w: "UP", s: "DOWN", a: "LEFT", d: "RIGHT", " ": "WAIT" };
    app.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      const a = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
      if (!a || (a === "WAIT" && S.key !== "tide")) return;
      e.preventDefault();
      move(a);
    });
    $("play-board-wrap").addEventListener("pointerdown", () => $("play-board-wrap").focus());
    load("mosaic");
    return { load: (key) => { load(key); $("play").scrollIntoView(); setTimeout(() => $("play-board-wrap").focus({ preventScroll: true }), 400); } };
  }

  // ---------------------------------------------------------------------------
  // Be the model: the three questions on real dataset items.
  // ---------------------------------------------------------------------------
  function quizApp() {
    const Q = { rq: "rq3", key: "mosaic", p: null, g: null, item: null, answered: false };
    const rqTabs = $("quiz-rq-tabs"), gameTabs = $("quiz-game-tabs"), body = $("quiz-body"), svg = $("quiz-board");
    const range = $("quiz-range"), rangeLabel = $("quiz-range-label"), scrub = $("quiz-scrub");
    const RQS = [["rq1", "RQ1 · Simulate"], ["rq2", "RQ2 · Foresight"], ["rq3", "RQ3 · Find the cause"]];
    RQS.forEach(([rq, label]) => {
      const t = el("button", "tab", label);
      t.setAttribute("role", "tab");
      t.dataset.rq = rq;
      t.addEventListener("click", () => { Q.rq = rq; next(); });
      rqTabs.appendChild(t);
    });
    KEYS.forEach((key) => {
      const b = el("button", null, R.games[key].name);
      b.dataset.key = key;
      b.addEventListener("click", () => { Q.key = key; next(); });
      gameTabs.appendChild(b);
    });
    const game = () => E.games[Q.key];
    const gi = () => KEYS.indexOf(Q.key);

    function draw(states, i, opts = {}) {
      B.draw(svg, Q.key, Q.g, Q.p, states[i], { coords: true, ...opts });
    }
    function useScrub(states, onChange) {
      scrub.hidden = false;
      range.max = states.length - 1;
      range.value = 0;
      const upd = () => {
        const i = +range.value;
        rangeLabel.textContent = i === 0 ? "Start" : `After move ${i}`;
        onChange(i);
      };
      range.oninput = upd;
      upd();
    }
    function moveList(acts, opts = {}) {
      const tl = el("div", "timeline");
      acts.forEach((a, k) => {
        const c = chip(a, k, "", opts.clickable ? "button" : "span");
        if (opts.clickable) c.addEventListener("click", () => opts.clickable(k + 1, c));
        tl.appendChild(c);
      });
      return tl;
    }
    function promptPeek(task) {
      const d = el("details", "prompt-peek");
      d.appendChild(el("summary", null, "See the exact prompt the models got"));
      d.appendChild(el("pre", null, fullPrompt(Q.key, Q.p, task)));
      return d;
    }
    function verdict(good, title, text) {
      const v = el("div", "verdict " + good);
      v.append(el("h5", null, title), el("p", null, text));
      return v;
    }
    function nextBtn() {
      const b = el("button", "btn btn-sm btn-primary", "Another question →");
      b.addEventListener("click", next);
      return b;
    }

    function next() {
      [...rqTabs.children].forEach((t) => t.setAttribute("aria-selected", t.dataset.rq === Q.rq));
      [...gameTabs.children].forEach((b) => b.setAttribute("aria-pressed", b.dataset.key === Q.key));
      Q.p = pick(goodPuzzles(Q.key));
      Q.g = game().prepare(Q.p);
      Q.answered = false;
      scrub.hidden = true;
      body.replaceChildren();
      ({ rq1, rq2, rq3 })[Q.rq]();
    }

    function rq1() {
      const acts = Q.p.rq1.actions;
      const states = E.replay(Q.key, Q.g, acts);
      const answer = Q.g.idx(Q.p.rq1.answer);
      body.append(el("h4", null, "Where does the agent end up?"), el("p", "q", `Starting from the board on the left, the agent makes these ${acts.length} moves. Click the tile where it ends up.`));
      body.appendChild(moveList(acts));
      body.appendChild(el("p", "hint", R.games[Q.key].rule));
      const onCell = (i) => {
        if (Q.answered) return;
        Q.answered = true;
        const right = i === answer;
        const marks = { [answer]: "right" };
        if (!right) marks[i] = "wrong";
        const path = states.map((s) => s.pos);
        useScrub(states, (k) => draw(states, k, { marks: k === states.length - 1 ? marks : { [i]: right ? "right" : "wrong" }, path: path.slice(0, k + 1) }));
        range.value = states.length - 1;
        range.oninput();
        const [r, c] = Q.p.rq1.answer;
        body.appendChild(verdict(right ? "good" : "bad", right ? "Right!" : "Not quite", right ? `The agent ends at (${r}, ${c}). Drag the slider to replay the moves.` : `The agent ends at (${r}, ${c}), marked in green. Drag the slider to replay the moves.`));
        minibars(body, `Model accuracy for this task in ${R.games[Q.key].name}`, Object.entries(R.rq1).map(([m, v]) => [m, v[gi()]]));
        body.appendChild(nextBtn());
      };
      draw(states, 0, { onCell });
      body.appendChild(promptPeek("rq1_main"));
    }

    function rq2() {
      const dead = Math.random() < 0.5;
      const acts = dead ? Q.p.rq2.dead : Q.p.rq2.safe;
      const states = E.replay(Q.key, Q.g, acts);
      const end = states[states.length - 1];
      body.append(el("h4", null, "What is the best next move to win?"), el("p", "q", `Starting from the board on the left, these ${acts.length} moves were made. What is the best next move to win?`));
      body.appendChild(moveList(acts));
      const show = el("label", "toggle");
      const cb = el("input");
      cb.type = "checkbox";
      show.append(cb, el("span"), document.createTextNode("Show the board after these moves (the models did not get this)"));
      cb.addEventListener("change", () => draw(states, cb.checked ? states.length - 1 : 0));
      body.appendChild(show);
      const row = el("div", "answer-row");
      [...game().actions, "NONE"].forEach((a) => {
        const b = el("button", "btn btn-sm" + (a === "NONE" ? " honest" : ""), a === "NONE" ? "No move can win" : `${ARROW[a] === "W" ? "" : ARROW[a] + " "}${a}`);
        b.addEventListener("click", () => answer(a));
        row.appendChild(b);
      });
      body.appendChild(row);
      body.appendChild(promptPeek(dead ? "rq2_hard_deadlock" : "rq2_hard_solvable"));
      draw(states, 0);

      function answer(a) {
        if (Q.answered) return;
        Q.answered = true;
        [...row.children].forEach((b) => (b.disabled = true));
        cb.checked = true;
        draw(states, states.length - 1);
        const last = acts[acts.length - 1];
        if (dead) {
          const right = a === "NONE";
          body.appendChild(verdict(right ? "good" : "bad", right ? "Right, it can't be won" : "There was no winning move", `The last move (${WORD[last]}) made the puzzle impossible, so there is no best move to win.${right ? "" : " Most models also gave a move here."}`));
          minibars(body, "Said it can't be won when asked for the best next move (all games)", Object.entries(R.rq2).map(([m, v]) => [m, v[0]]));
          body.appendChild(el("p", "hint", "Asked directly \"Is it still solvable?\" about the same states, the top four models were right 93 to 95% of the time."));
        } else if (a === "NONE") {
          const way = E.shortestPath(Q.key, Q.g, end, 4e5);
          body.appendChild(verdict("bad", "It can still be won", `This state can still be won${way ? `, for example by moving ${WORD[way[0]]} first` : ""}.`));
        } else {
          const legal = game().legal(Q.g, end).includes(a);
          if (!legal) {
            body.appendChild(verdict("bad", "That move isn't legal", `Something blocks ${WORD[a]} here. One good move is ${WORD[Q.p.rq2.safeAnswer]}.`));
          } else {
            const after = game().apply(Q.g, end, a);
            const safe = game().solve(Q.g, after, 3e6).ok;
            if (safe === null) {
              body.appendChild(verdict("info", "Unable to check this move quickly", "The browser solver reached its search limit. This move's effect on solvability is unknown."));
            } else {
              const beforePath = E.shortestPath(Q.key, Q.g, end, 4e5);
              const afterPath = safe ? E.shortestPath(Q.key, Q.g, after, 4e5) : null;
              const optimal = safe && beforePath && afterPath && afterPath.length === beforePath.length - 1;
              body.appendChild(optimal ? verdict("good", "Good move", "It keeps the puzzle winnable and is on a shortest path.")
                : safe ? verdict("info", "Safe move", "It keeps the puzzle winnable.")
                  : verdict("bad", "That move is fatal", `After ${WORD[a]}, the puzzle can no longer be won. A safe move is ${WORD[Q.p.rq2.safeAnswer]}.`));
            }
          }
          minibars(body, `Models whose move kept a winnable ${R.games[Q.key].name} puzzle winnable`, Object.entries(R.rq2Solvable).map(([m, v]) => [m, v[gi()][2]]));
        }
        body.appendChild(nextBtn());
      }
    }

    function rq3() {
      const acts = Q.p.rq3.actions;
      const states = E.replay(Q.key, Q.g, acts);
      const solv = rq3Solv(Q.key, Q.p);
      const fatal = Q.p.rq3.fatal;
      body.append(el("h4", null, "Which move made it impossible?"), el("p", "q", `After these ${acts.length} moves, the puzzle can't be completed. It became unsolvable at one of these steps. Click the fatal step.`));
      const tl = moveList(acts, { clickable: (k, c) => answer(k, c) });
      body.appendChild(tl);
      body.appendChild(el("p", "hint", "Use the slider under the board to step through the moves. The models only saw the starting board and this list."));
      body.appendChild(promptPeek("rq3_hard"));
      useScrub(states, (i) => {
        draw(states, i, { path: states.slice(0, i + 1).map((s) => s.pos) });
        [...tl.children].forEach((c, k) => c.classList.toggle("is-current", k === i - 1));
      });

      function answer(k, c) {
        if (Q.answered) return;
        Q.answered = true;
        [...tl.children].forEach((ch, j) => {
          ch.classList.add(solv[j + 1] ? "is-safe" : j + 1 === fatal ? "is-fatal" : "is-dead");
          ch.disabled = true;
        });
        c.classList.add("is-pick");
        range.value = fatal;
        range.oninput();
        const off = k - fatal;
        body.appendChild(verdict(off === 0 ? "good" : "bad", off === 0 ? "Exactly right" : `${off > 0 ? "Too late" : "Too early"} by ${plural(Math.abs(off), "move")}`,
          off === 0 ? `Move ${fatal} (${WORD[acts[fatal - 1]]}) made it impossible. It only became obvious ${plural(acts.length - fatal, "move")} later.`
            : off > 0 ? `The fatal move was ${fatal} (${WORD[acts[fatal - 1]]}). Most models that get this wrong also pick a later step.`
              : `The fatal move was ${fatal} (${WORD[acts[fatal - 1]]}). Before it, the puzzle could still be won.`));
        minibars(body, `Model accuracy for this task in ${R.games[Q.key].name}`, Object.entries(R.rq3).map(([m, v]) => [m, v[gi()][0]]));
        body.appendChild(nextBtn());
      }
    }
    next();
  }

  root.RubiconPlay = { playApp, quizApp, util: { goodPuzzles, rq3Solv, chip, setLamp } };
})(window);
