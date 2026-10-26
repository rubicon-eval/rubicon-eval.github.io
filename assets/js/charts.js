/*
 * Findings charts and results tables, drawn as inline SVG from
 * window.RUBICON_RESULTS. Every chart has a hover tooltip and a table view.
 */
(function (root) {
  "use strict";
  const R = root.RUBICON_RESULTS;
  const NS = "http://www.w3.org/2000/svg";
  const COL = { blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a", yellow: "#eda100", magenta: "#e87ba4", violet: "#6250d6", red: "#e34948" };
  const GAMES = ["Mosaic Grid", "Chain Vault", "Tide Grid"];

  function svgEl(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs = {}) {
    const t = svgEl("text", { x, y, ...attrs }, parent);
    t.textContent = str;
    return t;
  }
  function html(tag, cls, str) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (str !== undefined) e.textContent = str;
    return e;
  }
  // Horizontal bar with a 4px rounded data end and a square baseline end.
  function barPath(x0, x1, y, h) {
    const r = Math.min(4, Math.abs(x1 - x0) / 2, h / 2);
    if (x1 >= x0) return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
    return `M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z`;
  }

  // ---- tooltip -------------------------------------------------------------
  const tip = () => document.getElementById("tooltip");
  function showTip(evt, rows) {
    const t = tip();
    t.replaceChildren();
    rows.forEach(([label, value, color], i) => {
      const line = html("div");
      if (color) {
        const k = html("span", "tk");
        k.style.background = color;
        line.appendChild(k);
      }
      const b = html("b", null, value);
      line.appendChild(b);
      if (label) line.appendChild(document.createTextNode(" " + label));
      if (i === 0 && !value) line.firstChild && (line.style.fontWeight = 700);
      t.appendChild(line);
    });
    t.hidden = false;
    const pt = evt.clientX !== undefined && evt.clientX ? evt : (() => {
      const r = evt.target.getBoundingClientRect();
      return { clientX: r.left + r.width / 2, clientY: r.top };
    })();
    const x = Math.min(window.innerWidth - t.offsetWidth - 8, pt.clientX + 14);
    const y = Math.max(8, pt.clientY - t.offsetHeight - 10);
    t.style.left = x + "px";
    t.style.top = y + "px";
  }
  const hideTip = () => (tip().hidden = true);
  function hoverable(g, rowsFn) {
    g.setAttribute("tabindex", "0");
    g.setAttribute("class", "hov");
    g.addEventListener("pointermove", (e) => showTip(e, rowsFn()));
    g.addEventListener("focus", (e) => showTip(e, rowsFn()));
    g.addEventListener("pointerleave", hideTip);
    g.addEventListener("blur", hideTip);
  }

  function header(el, title, sub) {
    el.appendChild(html("p", "chart-title", title));
    if (sub) el.appendChild(html("p", "chart-sub", sub));
  }
  function legend(el, items) {
    const lg = html("div", "legend");
    items.forEach(([label, color, shape]) => {
      const s = html("span");
      const i = html("i", shape || "");
      i.style.background = color;
      s.append(i, document.createTextNode(label));
      lg.appendChild(s);
    });
    el.appendChild(lg);
  }
  function tableToggle(el, head, rows) {
    const btn = html("button", "table-toggle", "Show the numbers");
    const tbl = html("table", "data-table");
    tbl.hidden = true;
    const tr = html("tr");
    head.forEach((h) => tr.appendChild(html("th", null, h)));
    tbl.appendChild(tr);
    rows.forEach((r) => {
      const row = html("tr");
      r.forEach((c) => row.appendChild(html("td", null, c)));
      tbl.appendChild(row);
    });
    btn.addEventListener("click", () => {
      tbl.hidden = !tbl.hidden;
      btn.textContent = tbl.hidden ? "Show the numbers" : "Hide the numbers";
    });
    el.append(btn, tbl);
  }
  function xAxis(svg, x, y0, y1, ticks, fmt) {
    const g = svgEl("g", { class: "grid" }, svg);
    ticks.forEach((t) => {
      svgEl("line", { x1: x(t), x2: x(t), y1: y0, y2: y1 }, g);
      text(g, x(t), y1 + 16, fmt(t), { "text-anchor": "middle", class: "muted" });
    });
  }

  // ---- 01 integration gap: the same states, two questions -----------------
  // Each model's dot slides between its accuracy when asked directly and when
  // asked to play. The other position stays as a faint ghost.
  function askViz(box) {
    const plot = box.querySelector("#ask-plot"), q = box.querySelector("#ask-q"), seg = box.querySelector("#ask-seg");
    const rows = R.models.map((m) => ({ name: m.name, direct: R.rq2[m.name][2], play: R.rq2[m.name][0] })).sort((a, b) => b.direct - a.direct || b.play - a.play);
    // Draw at the real width so text stays readable on phones.
    const W = Math.max(320, Math.round(plot.clientWidth || 1100)), L = W < 600 ? 112 : 170, RT = W - (W < 600 ? 36 : 60), rowH = 38, top = 8;
    const H = top + rows.length * rowH + 34;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Each model's accuracy at spotting unwinnable states, by question" }, plot);
    const x = (v) => L + ((RT - L) * v) / 100;
    const ax = svgEl("g", { class: "axis" }, svg);
    [0, 25, 50, 75, 100].forEach((t) => {
      svgEl("line", { x1: x(t), x2: x(t), y1: top, y2: top + rows.length * rowH, stroke: "rgba(27,26,36,0.08)" }, ax);
      text(ax, x(t), top + rows.length * rowH + 22, t + "%", { "text-anchor": "middle" });
    });
    const COLOR = { direct: COL.blue, play: COL.orange };
    const items = rows.map((r, i) => {
      const cy = top + i * rowH + rowH / 2;
      const g = svgEl("g", {}, svg);
      svgEl("rect", { x: 0, y: cy - rowH / 2, width: W, height: rowH, fill: "transparent", class: "hitbox" }, g);
      text(g, L - 16, cy + 5, r.name, { "text-anchor": "end", class: r.name === "GPT-5.4" ? "label-strong" : "" });
      svgEl("line", { x1: x(0), x2: x(100), y1: cy, y2: cy, stroke: "rgba(27,26,36,0.1)", "stroke-width": 2, "stroke-linecap": "round" }, g);
      const ghost = svgEl("circle", { cx: x(0), cy, r: 8, fill: "none", "stroke-width": 2, "stroke-dasharray": "3 3", class: "ghost" }, g);
      const dot = svgEl("g", { class: "dot" }, g);
      const c = svgEl("circle", { cx: x(0), cy, r: 9, stroke: "#fff", "stroke-width": 2.5 }, dot);
      c.style.transition = "fill 0.6s";
      const val = text(dot, x(0) + 16, cy + 5, "", { class: "val" });
      hoverable(g, () => [[r.name, ""], ["Is it still solvable?", r.direct + "%", COLOR.direct], ["Best next move to win?", r.play + "%", COLOR.play]]);
      return { r, dot, c, val, ghost };
    });
    function setMode(mode) {
      const other = mode === "direct" ? "play" : "direct";
      q.textContent = mode === "direct" ? '"Is it still solvable?"' : '"What is the best next move to win?"';
      q.classList.toggle("play", mode === "play");
      [...seg.children].forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === mode));
      items.forEach(({ r, dot, c, val, ghost }, i) => {
        const v = r[mode];
        dot.style.transitionDelay = i * 45 + "ms";
        dot.style.transform = `translateX(${x(v) - x(0)}px)`;
        c.setAttribute("fill", COLOR[mode]);
        val.textContent = v + "%";
        const right = v < 88;
        val.setAttribute("x", right ? x(0) + 16 : x(0) - 16);
        val.setAttribute("text-anchor", right ? "start" : "end");
        ghost.setAttribute("cx", x(r[other]));
        ghost.setAttribute("stroke", COLOR[other]);
        ghost.style.opacity = Math.abs(r[other] - v) > 3 ? 0.55 : 0;
      });
      box.querySelector("#ask-note").textContent = mode === "direct"
        ? "How often each model said the puzzle can't be won, out of 300 unsolvable states."
        : "Same states, different prompt. The dashed circles show each model's score for \"Is it still solvable?\".";
    }
    [...seg.children].forEach((b) => b.addEventListener("click", () => { auto = false; setMode(b.dataset.mode); }));
    let auto = true;
    setMode("direct");
    new IntersectionObserver((es, obs) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      setTimeout(() => auto && setMode("play"), 1700);
    }), { rootMargin: "-25% 0px" }).observe(box);
    tableToggle(box, ["Model", "Is it still solvable?", "Best next move?", "Gap (pts)"], rows.map((r) => [r.name, r.direct + "%", r.play + "%", r.direct - r.play]));
  }

  // ---- 02 self-override bars --------------------------------------
  function overrideChart(el) {
    header(el, "Self-override among wrong responses (%)", "Among wrong answers, how often a model knew it could not win but still gave a move");
    const W = Math.max(320, el.clientWidth - 44), L = 120, RT = W - 60, rowH = 30, top = 6;
    const H = top + R.override.length * rowH + 26;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Bar chart of self-override rates" }, el);
    const x = (v) => L + ((RT - L) * v) / 100;
    xAxis(svg, x, top - 2, top + R.override.length * rowH, [0, 25, 50, 75, 100], (t) => t + "%");
    R.override.forEach(([name, wrong, over, pct], i) => {
      const y = top + i * rowH + 5;
      const g = svgEl("g", {}, svg);
      svgEl("rect", { x: 0, y: y - 5, width: W, height: rowH, fill: "transparent", class: "hitbox" }, g);
      text(g, L - 10, y + 12, name, { "text-anchor": "end" });
      svgEl("path", { d: barPath(x(0), x(pct), y, 16), fill: COL.violet, class: "mark" }, g);
      text(g, x(pct) + 6, y + 12, pct + "%", { class: "label-strong" });
      hoverable(g, () => [[name, ""], ["of wrong answers", pct + "%", COL.violet], [`${over} of ${wrong} wrong answers`, ""]]);
    });
    tableToggle(el, ["Model", "Wrong answers", "Self-override", "%"], R.override.map((r) => [r[0], r[1], r[2], r[3] + "%"]));
  }

  // ---- 03 late blame: diverging bars ---------------------------------------
  function lateChart(el) {
    header(el, "Error direction for wrong answers", "Share of wrong answers that point to a step before or after the true fatal step");
    const seg = html("div", "seg-row");
    const segInner = html("div", "seg");
    seg.appendChild(segInner);
    el.appendChild(seg);
    legend(el, [["Earlier than true cause", COL.blue, "sq"], ["Later than true cause", COL.red, "sq"]]);
    const holder = html("div");
    el.appendChild(holder);
    const draw = (gi) => {
      holder.replaceChildren();
      const names = Object.keys(R.later);
      const W = Math.max(320, el.clientWidth - 44), L = 120, mid = L + (W - L) / 2, half = (W - L) / 2 - 16, rowH = 26, top = 6;
      const H = top + names.length * rowH + 26;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Diverging bar chart of error direction" }, holder);
      const x = (v) => mid + (half * v) / 100;
      const g0 = svgEl("g", { class: "grid" }, svg);
      [-100, -50, 0, 50, 100].forEach((t) => {
        svgEl("line", { x1: x(t), x2: x(t), y1: top - 2, y2: top + names.length * rowH, stroke: t === 0 ? "#c3c2b7" : "#e1e0d9" }, g0);
        text(g0, x(t), top + names.length * rowH + 16, Math.abs(t) + "%", { "text-anchor": "middle", class: "muted" });
      });
      names.forEach((name, i) => {
        const later = R.later[name][gi];
        const y = top + i * rowH + 5;
        const g = svgEl("g", {}, svg);
        svgEl("rect", { x: 0, y: y - 5, width: W, height: rowH, fill: "transparent", class: "hitbox" }, g);
        text(g, L - 10, y + 12, name, { "text-anchor": "end" });
        if (later === null) {
          text(g, mid + 8, y + 12, "five or fewer errors", { class: "muted" });
          return;
        }
        if (later < 100) svgEl("path", { d: barPath(x(0) - 1, x(-(100 - later)), y, 16), fill: COL.blue, class: "mark" }, g);
        if (later > 0) svgEl("path", { d: barPath(x(0) + 1, x(later), y, 16), fill: COL.red, class: "mark" }, g);
        hoverable(g, () => [[name + " · " + GAMES[gi], ""], ["later", later + "%", COL.red], ["earlier", 100 - later + "%", COL.blue]]);
      });
      text(svg, x(-50), top + names.length * rowH + 2 + 0, "", {});
    };
    GAMES.forEach((name, gi) => {
      const b = html("button", null, name);
      b.setAttribute("aria-pressed", gi === 0);
      b.addEventListener("click", () => {
        [...segInner.children].forEach((c, j) => c.setAttribute("aria-pressed", j === gi));
        draw(gi);
      });
      segInner.appendChild(b);
    });
    draw(0);
    tableToggle(el, ["Model", ...GAMES.map((g) => g + " later")], Object.entries(R.later).map(([n, v]) => [n, ...v.map((x) => (x === null ? "few errors" : x + "%"))]));
  }

  // ---- 03b accuracy by cause-symptom gap: lines ----------------------------
  function gapLineChart(el) {
    header(el, "Accuracy by cause-symptom gap (Mosaic Grid)", "Steps between the fatal action and the end of the trace");
    const names = Object.keys(R.bySymptomGap);
    const colors = [COL.blue, COL.orange, COL.aqua, COL.yellow, COL.magenta];
    legend(el, names.map((n, i) => [n, colors[i], "line"]));
    const W = Math.max(320, el.clientWidth - 44), H = 250, L = 44, RT = W - 20, T = 10, B = 210;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Line chart of accuracy by cause-symptom gap" }, el);
    const x = (i) => L + 40 + ((RT - L - 80) * i) / 2;
    const y = (v) => B - ((B - T) * v) / 100;
    const grid = svgEl("g", { class: "grid" }, svg);
    [0, 25, 50, 75, 100].forEach((t) => {
      svgEl("line", { x1: L, x2: RT, y1: y(t), y2: y(t) }, grid);
      text(grid, L - 8, y(t) + 4, t + "%", { "text-anchor": "end", class: "muted" });
    });
    R.gapBins.forEach((b, i) => text(svg, x(i), B + 20, b + " steps", { "text-anchor": "middle", class: "muted" }));
    names.forEach((n, k) => {
      const v = R.bySymptomGap[n];
      svgEl("polyline", { points: v.map((d, i) => `${x(i)},${y(d)}`).join(" "), fill: "none", stroke: colors[k], "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      v.forEach((d, i) => svgEl("circle", { cx: x(i), cy: y(d), r: 4, fill: colors[k], stroke: "#fff", "stroke-width": 2 }, svg));
    });
    // Crosshair: one hit column per gap bin lists every series.
    const cross = svgEl("line", { y1: T, y2: B, stroke: "#c3c2b7", "stroke-width": 1, opacity: 0 }, svg);
    R.gapBins.forEach((b, i) => {
      const g = svgEl("g", {}, svg);
      svgEl("rect", { x: x(i) - 70, y: T, width: 140, height: B - T, fill: "transparent", class: "hitbox" }, g);
      hoverable(g, () => [[b + " steps", ""], ...names.map((n, k) => [n, R.bySymptomGap[n][i] + "%", colors[k]])]);
      g.addEventListener("pointerenter", () => {
        cross.setAttribute("x1", x(i));
        cross.setAttribute("x2", x(i));
        cross.setAttribute("opacity", 1);
      });
      g.addEventListener("pointerleave", () => cross.setAttribute("opacity", 0));
    });
    tableToggle(el, ["Model", ...R.gapBins], names.map((n) => [n, ...R.bySymptomGap[n].map((v) => v + "%")]));
  }

  // ---- results tables --------------------------------------------------------
  const RAMP = ["#fdfcf9", "#f5f8fd", "#eef3fc", "#e5eefb", "#dce8fa", "#d2e2f9", "#c7dbf7", "#bcd4f5", "#b0cdf3", "#a4c5f1", "#97bdee"];
  function heat(td, v) {
    if (v === null || v === undefined || isNaN(v)) return;
    const i = Math.max(0, Math.min(10, Math.round(v / 10)));
    td.classList.add("heat");
    td.style.background = RAMP[i];
  }
  const avg = (a) => +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1);
  const TABLES = [
    {
      id: "rq1", label: "Simulation (RQ1)",
      note: "Exact-match accuracy for predicting where the agent ends up after 5, 10 or 15 moves. GPT-5.4 and Gemini 3.1 Pro score 100% on every puzzle, so basic simulation errors are unlikely to explain later failures. On Chain Vault, smaller models often misread the door rule.",
      groups: null, cols: ["Mosaic", "Chain", "Tide", "Avg"],
      row: (m) => [...R.rq1[m], avg(R.rq1[m])],
    },
    {
      id: "rq2", label: "Foresight (RQ2)",
      note: "Unsolvable-state detection when asked for the best next move (unprompted) and when asked \"Is it still solvable?\" (explicit). The last two columns are for the matching solvable states. F1 is shown as a percentage.",
      groups: [["Unprompted", 2], ["Explicit", 2], ["Solvable", 2]],
      cols: ["Acc", "F1", "Acc", "F1", "Acc", "F1"],
      row: (m) => R.rq2[m].map((v, i) => (i % 2 ? Math.round(v * 100) : v)),
    },
    {
      id: "safe", label: "Solvable states (RQ2)",
      note: "For solvable states, whether the suggested move is on a shortest path (Opt), legal (Valid), and does not make the puzzle unsolvable (Safe). Tide Grid separates the models most: weaker models make it unsolvable in up to 46% of these puzzles.",
      groups: [["Mosaic", 3], ["Chain", 3], ["Tide", 3]],
      cols: ["Opt", "Valid", "Safe", "Opt", "Valid", "Safe", "Opt", "Valid", "Safe"],
      row: (m) => R.rq2Solvable[m].flat(),
    },
    {
      id: "rq3", label: "Attribution (RQ3)",
      note: "Exact-match accuracy for identifying the fatal step. Start: the model gets the initial state image and the action trace. End: it gets the final state image instead. Seeing the final state does not reliably help, and sometimes hurts.",
      groups: [["Mosaic", 2], ["Chain", 2], ["Tide", 2], ["", 1]],
      cols: ["Start", "End", "Start", "End", "Start", "End", "Avg"],
      row: (m) => [...R.rq3[m].flat(), avg(R.rq3[m].flat())],
    },
    {
      id: "gap", label: "Integration gap by game",
      note: "Explicit minus unprompted detection accuracy on unsolvable states, in percentage points. Higher means a bigger gap.",
      groups: null, cols: ["Mosaic", "Chain", "Tide", "Avg"],
      row: (m) => [...R.gapByGame[m], avg(R.gapByGame[m])],
    },
  ];

  function resultsTables(el) {
    const tabs = html("div", "tabs");
    tabs.setAttribute("role", "tablist");
    const body = html("div", "results-body");
    el.append(tabs, body);
    let sort = { col: -1, dir: -1 };
    const render = (t) => {
      body.replaceChildren();
      body.appendChild(html("p", "results-note", t.note));
      const table = html("table", "res");
      const thead = html("thead");
      if (t.groups) {
        const tr = html("tr");
        tr.appendChild(html("th", "group", ""));
        t.groups.forEach(([g, n]) => {
          const th = html("th", "group", g);
          th.colSpan = n;
          tr.appendChild(th);
        });
        thead.appendChild(tr);
      }
      const tr = html("tr");
      ["Model", ...t.cols].forEach((c, i) => {
        const th = html("th", sort.col === i - 1 ? "sorted" : "", c);
        if (sort.col === i - 1) th.appendChild(html("span", "arrow", sort.dir < 0 ? "▼" : "▲"));
        th.addEventListener("click", () => {
          sort = sort.col === i - 1 ? { col: i - 1, dir: -sort.dir } : { col: i - 1, dir: i ? -1 : 1 };
          render(t);
        });
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
      const rows = R.models.map((m) => ({ m, v: t.row(m.name) }));
      if (sort.col >= 0) rows.sort((a, b) => sort.dir * (a.v[sort.col] - b.v[sort.col]));
      else if (sort.col === -1 && sort.dir === 1) rows.sort((a, b) => a.m.name.localeCompare(b.m.name));
      const tb = html("tbody");
      rows.forEach(({ m, v }) => {
        const r = html("tr");
        const name = html("td", "model", m.name);
        name.appendChild(html("small", null, m.size));
        r.appendChild(name);
        v.forEach((x) => {
          const td = html("td", null, String(x));
          heat(td, x);
          r.appendChild(td);
        });
        tb.appendChild(r);
      });
      table.appendChild(tb);
      const cols = rows[0].v.length;
      for (let k = 0; k < cols; k++) {
        const best = Math.max(...rows.map((r) => r.v[k]));
        [...tb.children].forEach((tr, j) => rows[j].v[k] === best && tr.children[k + 1].classList.add("top"));
      }
      body.appendChild(table);
    };
    TABLES.forEach((t, i) => {
      const b = html("button", "tab", t.label);
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === 0);
      b.addEventListener("click", () => {
        [...tabs.children].forEach((c, j) => c.setAttribute("aria-selected", j === i));
        sort = { col: -1, dir: -1 };
        render(t);
      });
      tabs.appendChild(b);
    });
    render(TABLES[0]);
  }

  root.RubiconCharts = { askViz, overrideChart, lateChart, gapLineChart, resultsTables, showTip, hideTip };
})(window);
