/*
 * The narrative layer: the tile-grid hero, the scroll-driven "crossing" story,
 * the looping game panels, the typing reasoning trace and page chrome.
 */
(function (root) {
  "use strict";
  const E = root.RubiconEngines;
  const B = root.RubiconBoard;
  const R = root.RUBICON_RESULTS;
  const DATA = root.RUBICON_DATA;
  const U = root.RubiconPlay.util;
  const $ = (id) => document.getElementById(id);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WORD = { UP: "up", DOWN: "down", LEFT: "left", RIGHT: "right", WAIT: "wait" };

  // Run fn(visible) whenever el enters or leaves the viewport.
  function whenVisible(el, fn, margin = "0px") {
    new IntersectionObserver((es) => es.forEach((e) => fn(e.isIntersecting)), { rootMargin: margin }).observe(el);
  }

  // ---------------------------------------------------------------------------
  // Hero: "RUBICON" spelled in wall tiles. An agent wanders; every tile it
  // leaves becomes a wall. The HUD reports when the exit became unreachable.
  // ---------------------------------------------------------------------------
  const FONT = {
    R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  };
  const HC = { bg: "#f5f1e8", floor: "rgba(27,26,36,0.045)", wall: "#2c3e50", paint: "#5dade2", exitBg: "#fcf3cf", star: "#f1c40f", starEdge: "#b7950b", agent: "#2980b9", lostStar: "#c9c4b8" };

  function hero() {
    const cv = $("hero-canvas"), ctx = cv.getContext("2d");
    const hud = $("hero-hud"), hudText = $("hero-hud-text"), copy = $("hero-copy"), hint = document.querySelector(".hero-hint");
    const G = {};
    let raf = 0, running = false, lastStep = 0, pointerTile = -1;

    function layout() {
      const rect = cv.getBoundingClientRect();
      G.W = rect.width;
      G.H = rect.height;
      G.dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(G.W * G.dpr);
      cv.height = Math.round(G.H * G.dpr);
      G.T = Math.max(7, Math.min(26, Math.floor(Math.min(G.W * 0.88, 980) / 41)));
      G.cols = Math.ceil(G.W / G.T) + 1;
      G.rows = Math.ceil(G.H / G.T) + 1;
      G.ox = Math.round((G.W - G.cols * G.T) / 2);
      G.n = G.cols * G.rows;
      G.block = new Uint8Array(G.n); // 1 = title wall, 2 = keep clear (behind the text)
      G.c0 = Math.floor((G.cols - 41) / 2);
      G.r0 = Math.max(2, Math.floor(G.rows * 0.27) - 3);
      [..."RUBICON"].forEach((ch, k) => FONT[ch].forEach((line, r) => [...line].forEach((bit, c) => {
        if (bit === "1") G.block[(G.r0 + r) * G.cols + G.c0 + k * 6 + c] = 1;
      })));
      copy.style.setProperty("--copy-top", (G.r0 + 7) * G.T + G.T * 1.6 + "px");
      // Keep the agent out from behind the paragraph text.
      const cr = copy.getBoundingClientRect(), hr = cv.getBoundingClientRect();
      for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
        const x = G.ox + c * G.T, y = r * G.T;
        const inside = x + G.T > cr.left - hr.left - G.T && x < cr.right - hr.left + G.T && y + G.T > cr.top - hr.top - G.T * 0.5 && y < cr.bottom - hr.top + G.T * 0.5;
        const i = r * G.cols + c;
        if (inside && !G.block[i]) G.block[i] = 2;
      }
      // The status line and the hint are also kept clear.
      for (const el of [hud, hint]) {
        const hb = el.getBoundingClientRect();
        if (!hb.width) continue;
        for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
          const x = G.ox + c * G.T, y = r * G.T, i = r * G.cols + c;
          if (!G.block[i] && x + G.T > hb.left - hr.left - 4 && x < hb.right - hr.left + 4 && y + G.T > hb.top - hr.top - 4) G.block[i] = 2;
        }
      }
      reset();
    }
    const free = (i) => i >= 0 && !G.block[i] && !G.paint[i];
    function nbrs(i) {
      const r = Math.floor(i / G.cols), c = i % G.cols, out = [];
      if (r > 0) out.push(i - G.cols);
      if (r < G.rows - 1) out.push(i + G.cols);
      if (c > 0) out.push(i - 1);
      if (c < G.cols - 1) out.push(i + 1);
      return out;
    }
    function reachable(from, to) {
      const seen = new Uint8Array(G.n), q = [from];
      seen[from] = 1;
      for (let h = 0; h < q.length; h++) {
        if (q[h] === to) return true;
        for (const j of nbrs(q[h])) if (!seen[j] && (free(j) || j === to)) { seen[j] = 1; q.push(j); }
      }
      return false;
    }
    function pickFree(near, minD, maxD) {
      for (let k = 0; k < 4000; k++) {
        const i = Math.floor(Math.random() * G.n);
        if (!free(i)) continue;
        if (near === undefined) return i;
        const d = Math.abs(Math.floor(i / G.cols) - Math.floor(near / G.cols)) + Math.abs((i % G.cols) - (near % G.cols));
        if (d >= minD && d <= maxD) return i;
      }
      return -1;
    }
    function reset() {
      G.paint = new Float32Array(G.n);
      // Start in the open band below or above the title.
      G.agent = pickFree();
      G.exit = pickFree(G.agent, 8, 16);
      G.prev = G.agent;
      G.moves = 0;
      G.lostAt = 0;
      G.byUser = false;
      G.over = null;
      G.dir = 0;
      G.anim = 1;
      setHud();
    }
    function setHud() {
      hud.classList.toggle("lost", !!G.lostAt && G.over !== "won");
      hud.classList.toggle("won", G.over === "won");
      let t;
      if (G.over === "won") t = `Move ${G.moves}: <b>the agent reached the exit.</b>`;
      else if (G.over === "stuck") t = `<b>Stuck after ${G.moves} moves.</b> The exit was out of reach from move ${G.lostAt}${G.byUser ? " (you blocked it)" : ""}.`;
      else if (G.lostAt) t = `Move ${G.moves}: still has moves, but <b>the exit is out of reach since move ${G.lostAt}.</b>`;
      else t = `Move ${G.moves}: the agent can still reach the exit.`;
      hudText.innerHTML = t;
    }
    function step() {
      if (G.over) return;
      const opts = nbrs(G.agent).filter((j) => free(j) || j === G.exit);
      if (!opts.length) {
        G.over = "stuck";
        if (!G.lostAt) G.lostAt = G.moves;
        setHud();
        setTimeout(() => G.over === "stuck" && fadeAndReset(), 3200);
        return;
      }
      // Avoid stepping straight into a dead end when there is a choice, so the
      // agent wanders for a while before it seals itself in.
      const open = (j) => nbrs(j).filter((k) => k !== G.agent && (free(k) || k === G.exit)).length;
      const safe = opts.filter((j) => j === G.exit || open(j) > 0);
      const cands = safe.length ? safe : opts;
      let next = cands[Math.floor(Math.random() * cands.length)];
      if (cands.includes(G.agent + G.dir) && Math.random() < 0.6) next = G.agent + G.dir;
      G.dir = next - G.agent;
      G.paint[G.agent] = performance.now();
      G.prev = G.agent;
      G.agent = next;
      G.anim = 0;
      G.moves++;
      if (G.agent === G.exit) {
        G.over = "won";
        setHud();
        setTimeout(fadeAndReset, 2400);
        return;
      }
      checkLost(false);
    }
    function checkLost(byUser) {
      if (!G.lostAt && !reachable(G.agent, G.exit)) {
        G.lostAt = Math.max(1, G.moves);
        G.byUser = byUser;
      }
      setHud();
    }
    function fadeAndReset() {
      G.fading = performance.now();
    }
    function draw(now) {
      const { T, ox } = G;
      ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
      ctx.fillStyle = HC.bg;
      ctx.fillRect(0, 0, G.W, G.H);
      let fade = 1;
      if (G.fading) {
        fade = Math.max(0, 1 - (now - G.fading) / 700);
        if (fade === 0) {
          G.fading = 0;
          reset();
          fade = 1;
        }
      }
      const pad = T > 12 ? 1.5 : 1, rr = T > 12 ? 3 : 1.5;
      for (let i = 0; i < G.n; i++) {
        const x = ox + (i % G.cols) * T, y = Math.floor(i / G.cols) * T;
        if (G.block[i] === 1) ctx.fillStyle = HC.wall;
        else if (G.paint[i]) {
          const a = Math.min(1, (now - G.paint[i]) / 350) * fade;
          ctx.fillStyle = `rgba(93,173,226,${0.92 * a})`;
        } else ctx.fillStyle = HC.floor;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x + pad, y + pad, T - 2 * pad, T - 2 * pad, rr) : ctx.rect(x + pad, y + pad, T - 2 * pad, T - 2 * pad);
        ctx.fill();
        if (G.paint[i] && T > 12 && !G.block[i]) {
          ctx.strokeStyle = `rgba(255,255,255,${0.6 * fade})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          const m = T * 0.32;
          ctx.moveTo(x + m, y + m); ctx.lineTo(x + T - m, y + T - m);
          ctx.moveTo(x + T - m, y + m); ctx.lineTo(x + m, y + T - m);
          ctx.stroke();
        }
      }
      // exit star
      const ex = ox + (G.exit % G.cols) * T, ey = Math.floor(G.exit / G.cols) * T;
      ctx.fillStyle = G.lostAt && G.over !== "won" ? "#ece8de" : HC.exitBg;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(ex + pad, ey + pad, T - 2 * pad, T - 2 * pad, rr) : ctx.rect(ex + pad, ey + pad, T - 2 * pad, T - 2 * pad);
      ctx.fill();
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = (k % 2 ? 0.18 : 0.4) * T, a = -Math.PI / 2 + (k * Math.PI) / 5;
        ctx.lineTo(ex + T / 2 + r * Math.cos(a), ey + T / 2 + r * Math.sin(a));
      }
      ctx.closePath();
      ctx.fillStyle = G.lostAt && G.over !== "won" ? HC.lostStar : HC.star;
      ctx.fill();
      // agent, gliding between tiles
      G.anim = Math.min(1, G.anim + 0.12);
      const e = 1 - Math.pow(1 - G.anim, 3);
      const ax = ox + ((G.prev % G.cols) + ((G.agent % G.cols) - (G.prev % G.cols)) * e) * T + T / 2;
      const ay = (Math.floor(G.prev / G.cols) + (Math.floor(G.agent / G.cols) - Math.floor(G.prev / G.cols)) * e) * T + T / 2;
      ctx.beginPath();
      ctx.arc(ax, ay, T * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = G.over === "stuck" ? "#d43c3c" : HC.agent;
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, T * 0.08);
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
    function frame(now) {
      if (!running) return;
      if (now - lastStep > 150 && !G.fading) {
        lastStep = now;
        step();
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running || reduced()) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    cv.addEventListener("pointermove", (ev) => {
      const r = cv.getBoundingClientRect();
      const c = Math.floor((ev.clientX - r.left - G.ox) / G.T), rr = Math.floor((ev.clientY - r.top) / G.T);
      if (c < 0 || rr < 0 || c >= G.cols || rr >= G.rows) return;
      const i = rr * G.cols + c;
      if (i === pointerTile) return;
      if (pointerTile >= 0 && free(pointerTile) && pointerTile !== G.agent && pointerTile !== G.exit && !G.over) {
        G.paint[pointerTile] = performance.now();
        checkLost(true);
      }
      pointerTile = i;
    });
    cv.addEventListener("pointerleave", () => (pointerTile = -1));
    let rt = 0;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { layout(); if (!running) draw(performance.now()); }, 150);
    });
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    layout();
    if (reduced()) {
      for (let k = 0; k < 40; k++) step();
      G.anim = 1;
      draw(performance.now() + 1000);
    }
    whenVisible(cv, (v) => (v ? start() : stop()));
  }

  // ---------------------------------------------------------------------------
  // Act I: a scroll-driven telling of one real trace.
  // ---------------------------------------------------------------------------
  function crossing() {
    const key = "mosaic";
    const cands = U.goodPuzzles(key).filter((p) => p.rq3.fatal <= 2 && p.rq3.actions.length >= 8 && p.rq3.actions.length <= 14);
    cands.sort((a, b) => a.rq3.fatal - b.rq3.fatal || b.rq3.gap - a.rq3.gap || b.w - a.w);
    const p = cands[0];
    const g = E.games[key].prepare(p);
    const acts = p.rq3.actions;
    const states = E.replay(key, g, acts);
    const solv = U.rq3Solv(key, p);
    const f = p.rq3.fatal, n = acts.length;
    const mid = Math.min(n - 2, f + Math.ceil((n - f) / 2));
    const fatalTile = states[f - 1].pos;
    const svg = $("stage-board"), lamp = $("stage-lamp"), tl = $("stage-timeline"), cap = $("stage-cap");
    tl.replaceChildren(...acts.map((a, k) => U.chip(a, k)));

    // Text follows Figure 1 of the paper, including its speech bubbles.
    const STEPS = [
      { at: 0, lamp: ["ok", "Solvable"], reveal: false, k: "Initial state",
        html: `<p>"Easy! I'll just go ${WORD[acts[0]].toUpperCase()}."</p><p>The puzzle begins in a solvable state. The agent (blue circle) has to step on every plate of a color to open the matching door, then reach the exit (gold star). Every tile it leaves turns into a wall.</p>` },
      { at: f, lamp: ["hidden-state", "No warning"], reveal: false, k: `Step ${f}`,
        html: `<p>"Looks fine to me!"</p><p>Moving ${acts[f - 1]} is completely legal, and nothing on the board looks wrong.</p>` },
      { at: mid, lamp: ["hidden-state", "No warning"], reveal: false, k: `Step ${mid}`,
        html: `<p>"Still going..."</p><p>Every move is still legal and the agent still has somewhere to go.</p>` },
      { at: n, lamp: ["dead", "Stuck"], reveal: false, k: `Step ${n}`,
        html: `<p>"Wait... I'm stuck?!"</p><p>The agent can't reach the exit anymore. This is the first point where the problem is easy to see.</p>` },
      { at: f, lamp: ["dead", `Lost at step ${f}`], reveal: true, mark: true, k: "Point of no return",
        html: `<p>The failure was decided at <span class="red">step ${f}</span>.</p><p>Leaving the circled tile turned it into a wall and blocked the only route back to the exit. The damage only became obvious ${n - f} steps later.</p>` },
      { at: n, lamp: ["dead", "Unsolvable"], reveal: true, path: true, k: "What we test",
        html: `<p>Would a model catch this?</p><div class="rq-list"><div><b>RQ1</b><span><strong>Simulation.</strong> Does the model understand the environment?</span></div><div class="r2"><b>RQ2</b><span><strong>Foresight.</strong> Does it detect and report when the task is impossible?</span></div><div class="r3"><b>RQ3</b><span><strong>Attribution.</strong> Can it find the action that made the task impossible?</span></div></div>` },
    ];
    const box = $("steps");
    STEPS.forEach((s, i) => {
      const st = document.createElement("div");
      st.className = "step";
      st.dataset.i = i;
      st.innerHTML = `<div class="step-box"><span class="k">${s.k}</span>${s.html}</div>`;
      box.appendChild(st);
    });
    function show(i) {
      const s = STEPS[i];
      [...box.children].forEach((c, j) => c.classList.toggle("on", j === i));
      const opts = {};
      if (s.mark) opts.marks = { [fatalTile]: "wrong" };
      if (s.path) opts.path = states.map((x) => x.pos);
      B.draw(svg, key, g, p, states[s.at], opts);
      U.setLamp(lamp, s.lamp[0], s.lamp[1]);
      [...tl.children].forEach((c, k) => {
        let cls = "chip";
        if (k < s.at || (s.reveal && k < n)) cls += s.reveal ? (solv[k + 1] ? " is-safe" : k + 1 === f ? " is-fatal" : " is-dead") : "";
        if (k === s.at - 1) cls += " is-current";
        c.className = cls;
        c.style.opacity = s.reveal || k < s.at ? 1 : 0.45;
      });
      cap.textContent = s.at === 0 ? "Step 0" : `Step ${s.at} of ${n}`;
    }
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(+e.target.dataset.i)), { rootMargin: "-45% 0px -45% 0px" });
    [...box.children].forEach((c) => io.observe(c));
    show(0);
  }

  // ---------------------------------------------------------------------------
  // Act II: one panel per game, each looping a real fatal trace.
  // ---------------------------------------------------------------------------
  const LOOK = {
    mosaic: { glow: "rgba(93,173,226,0.22)", accent: "#2471a3" },
    chain: { glow: "rgba(241,148,138,0.24)", accent: "#c0392b" },
    tide: { glow: "rgba(212,165,116,0.28)", accent: "#9a6b3b" },
  };
  function games(onPlay) {
    const box = $("game-rows");
    ["mosaic", "chain", "tide"].forEach((key) => {
      const info = R.games[key];
      const p = U.goodPuzzles(key).filter((x) => x.rq3.actions.length <= 16 && x.rq3.fatal >= 2 && x.w <= 7).sort((a, b) => b.rq3.gap - a.rq3.gap)[0] || DATA[key].puzzles[0];
      const g = E.games[key].prepare(p);
      const acts = p.rq3.actions, states = E.replay(key, g, acts), solv = U.rq3Solv(key, p);
      const row = document.createElement("article");
      row.className = "game-row panel reveal";
      row.style.setProperty("--glow", LOOK[key].glow);
      row.style.setProperty("--accent", LOOK[key].accent);
      row.innerHTML = `<div class="game-art"><svg class="board" role="img" aria-label="${info.name} example"></svg><p class="stage-cap"><span class="lamp lamp-sm"><span class="lamp-dot"></span><span class="lamp-text"></span></span> <span class="cnt"></span></p></div>
        <div class="game-text"><span class="tag">${info.axis}</span><h3>${info.name}</h3>
        <dl><dt>Goal</dt><dd>${info.goal}</dd><dt>Irreversible rule</dt><dd class="rule">${info.rule}</dd><dt>Failure</dt><dd class="fail">${info.fail}</dd></dl>
        <button class="chipbtn primary">Play ${info.name} →</button></div>`;
      box.appendChild(row);
      row.querySelector("button").addEventListener("click", () => onPlay(key));
      const svg = row.querySelector("svg"), lamp = row.querySelector(".lamp"), cnt = row.querySelector(".cnt");
      let i = 0, timer = 0, on = false;
      const show = () => {
        B.draw(svg, key, g, p, states[i]);
        const dead = !solv[i];
        U.setLamp(lamp, dead ? "dead" : "ok", dead ? (i === p.rq3.fatal ? "Point of no return" : "Unsolvable") : "Solvable");
        cnt.textContent = i ? `step ${i} of ${acts.length}` : "step 0";
      };
      const tick = () => {
        if (!on) return;
        timer = setTimeout(() => {
          i = i >= acts.length ? 0 : i + 1;
          show();
          tick();
        }, i === acts.length ? 2200 : i === p.rq3.fatal ? 1500 : 650);
      };
      show();
      whenVisible(row, (v) => {
        on = v && !reduced();
        clearTimeout(timer);
        if (on) tick();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Finding 02: the reasoning trace types itself out.
  // ---------------------------------------------------------------------------
  function terminal() {
    const body = $("term-body"), who = $("term-who");
    let qi = 0, timer = 0, visible = false;
    function play(i) {
      clearTimeout(timer);
      qi = (i + R.quotes.length) % R.quotes.length;
      const q = R.quotes[qi];
      who.textContent = `${q.model} / ${q.game}`;
      body.replaceChildren();
      const caret = document.createElement("span");
      caret.className = "caret";
      const segs = q.parts.map(([kind, text]) => {
        const s = document.createElement("span");
        if (kind) s.className = kind;
        body.appendChild(s);
        return [s, text];
      });
      body.appendChild(caret);
      if (reduced()) {
        segs.forEach(([s, t]) => (s.textContent = t));
        return;
      }
      let si = 0, ci = 0;
      const type = () => {
        if (si >= segs.length) {
          timer = setTimeout(() => visible && play(qi + 1), 4200);
          return;
        }
        const [s, t] = segs[si];
        ci += 2;
        s.textContent = t.slice(0, ci);
        if (ci >= t.length) { si++; ci = 0; }
        // Pause briefly after the model admits it is impossible.
        timer = setTimeout(type, ci === 0 && s.className === "know" ? 700 : 22);
      };
      type();
    }
    $("term-prev").addEventListener("click", () => play(qi - 1));
    $("term-next").addEventListener("click", () => play(qi + 1));
    let started = false;
    whenVisible(body, (v) => {
      visible = v;
      if (v && !started) { started = true; play(0); }
    }, "-20% 0px");
    // Show the first quote in full until it scrolls into view.
    R.quotes[0].parts.forEach(([kind, t]) => {
      const s = document.createElement("span");
      if (kind) s.className = kind;
      s.textContent = t;
      body.appendChild(s);
    });
    who.textContent = `${R.quotes[0].model} / ${R.quotes[0].game}`;
  }

  // ---------------------------------------------------------------------------
  // Page chrome: dock nav and reveal-on-scroll.
  // ---------------------------------------------------------------------------
  function chrome() {
    const dock = $("dock");
    whenVisible($("top"), (v) => dock.classList.toggle("show", !v), "-30% 0px 0px 0px");
    const links = [...dock.querySelectorAll("a[href^='#']")].filter((a) => a.getAttribute("href") !== "#top");
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
    }), { rootMargin: "-45% 0px -50% 0px" });
    links.forEach((a) => {
      const s = document.querySelector(a.getAttribute("href"));
      if (s) io.observe(s);
    });
    const rv = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal").forEach((el) => rv.observe(el));
  }

  root.RubiconStory = { hero, crossing, games, terminal, chrome };
})(window);
