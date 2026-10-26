/*
 * SVG board renderer for the three RUBICON games. Colors match the dataset
 * images (puzzles/common/rendering.py and the per-game renderers).
 *
 *   RubiconBoard.draw(svg, key, g, puzzle, state, opts)
 *
 * opts: coords (row/col labels), onCell(idx) (click handler), marks
 * ({idx: "pick" | "right" | "wrong"}), path (cell indices to trace).
 */
(function (root) {
  "use strict";

  const S = 10;
  // Two palettes: "day" matches the dataset images, "night" is the site's dark theme.
  const THEMES = {
    day: {
      C: {
        floor: "#E8E8EC", wall: "#2C3E50", agent: "#2980B9", exitFill: "#FCF3CF", star: "#F1C40F", starEdge: "#B7950B",
        painted: "#5DADE2", paintX: "#ffffff", dry: "#D4A574", flooded: "#2471A3", beacon: "#E67E22", beaconEdge: "#a04000",
        collected: "#a8a5b3", plateEdge: "#B7950B", coord: "#8b879b", zoneDry: "#5b3d1e", zoneWet: "#d9ecfb", won: "#198754",
        path: "#6b3fa0", right: "#198754", wrong: "#d23f3f", pick: "#6b3fa0", ring: "#ffffff",
      },
      LINK: {
        blue: { fill: "#AED6F1", icon: "#2471A3", open: "#D6E6F2" },
        green: { fill: "#A9DFBF", icon: "#1E8449", open: "#D4EFDF" },
        orange: { fill: "#F5CBA7", icon: "#CA6F1E", open: "#FAE5D3" },
        purple: { fill: "#D7BDE2", icon: "#7D3C98", open: "#EBDEF0" },
      },
      KEY: {
        red: { fill: "#FADBD8", icon: "#E74C3C", door: "#F1948A", bars: "#C0392B" },
        blue: { fill: "#D6EAF8", icon: "#3498DB", door: "#85C1E9", bars: "#2471A3" },
        green: { fill: "#D5F5E3", icon: "#27AE60", door: "#82E0AA", bars: "#1E8449" },
        yellow: { fill: "#FEF9E7", icon: "#F1C40F", door: "#F7DC6F", bars: "#B7950B" },
      },
    },
    night: {
      C: {
        floor: "#1a2036", wall: "#07090f", agent: "#7fd0ff", exitFill: "#3a3216", star: "#ffd23f", starEdge: "#c79a12",
        painted: "#2a6db0", paintX: "#cfe6ff", dry: "#b08353", flooded: "#174f86", beacon: "#ff9f43", beaconEdge: "#ffcf99",
        collected: "#4c5269", plateEdge: "#00000066", coord: "#5d6282", zoneDry: "#2e1f0f", zoneWet: "#9cc7ef", won: "#3ccf83",
        path: "#c4a8ff", right: "#3ccf83", wrong: "#ff5a5a", pick: "#c4a8ff", ring: "#0b0e19",
      },
      LINK: {
        blue: { fill: "#1d3a5e", icon: "#62b4f0", open: "#141f33" },
        green: { fill: "#183f2e", icon: "#3ccf83", open: "#122a20" },
        orange: { fill: "#4a2f18", icon: "#f39c50", open: "#2c1d10" },
        purple: { fill: "#3a2752", icon: "#c39bea", open: "#241933" },
      },
      KEY: {
        red: { fill: "#45191d", icon: "#ff6b5e", door: "#6e2328", bars: "#ff9488" },
        blue: { fill: "#172d48", icon: "#5aa9f0", door: "#1f4068", bars: "#93caff" },
        green: { fill: "#143825", icon: "#43d17f", door: "#1b5235", bars: "#86e6ae" },
        yellow: { fill: "#3a3112", icon: "#f5c93a", door: "#5a4b14", bars: "#ffe27f" },
      },
    },
  };
  let C = THEMES.day.C, LINK = THEMES.day.LINK, KEY = THEMES.day.KEY;
  function setTheme(name) {
    ({ C, LINK, KEY } = THEMES[name]);
  }

  const rect = (x, y, fill, extra = "") =>
    `<rect x="${x + 0.4}" y="${y + 0.4}" width="9.2" height="9.2" rx="1.2" fill="${fill}" ${extra}/>`;
  const star = (x, y) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 1.6 : 3.6, a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${(x + 5 + r * Math.cos(a)).toFixed(2)},${(y + 5 + r * Math.sin(a)).toFixed(2)}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${C.star}" stroke="${C.starEdge}" stroke-width="0.45" stroke-linejoin="round"/>`;
  };
  const diamond = (x, y, fill, stroke, r = 2.6) =>
    `<polygon points="${x + 5},${y + 5 - r} ${x + 5 + r},${y + 5} ${x + 5},${y + 5 + r} ${x + 5 - r},${y + 5}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>`;
  const keyIcon = (x, y, col) =>
    `<g stroke="${col}" stroke-width="1.1" stroke-linecap="round" fill="none"><circle cx="${x + 3.6}" cy="${y + 3.8}" r="1.6" fill="${col}"/><path d="M${x + 4.8} ${y + 5}L${x + 7.4} ${y + 7.6}M${x + 6.4} ${y + 6.6}L${x + 7.4} ${y + 5.6}"/></g>`;

  function mosaicCell(g, p, s, i, x, y, fresh) {
    const E = root.RubiconEngines.games.mosaic;
    if (g.wall[i]) return rect(x, y, C.wall);
    if (E.painted(s, i)) {
      const cls = fresh.has(i) ? 'class="cell-paint"' : "";
      return `<g ${cls}>${rect(x, y, C.painted)}<path d="M${x + 3} ${y + 3}L${x + 7} ${y + 7}M${x + 7} ${y + 3}L${x + 3} ${y + 7}" stroke="${C.paintX}" stroke-width="0.6" opacity="0.65"/></g>`;
    }
    const d = g.doorAt[i];
    if (d >= 0) {
      const col = LINK[g.doors[d].color];
      if (E.doorOpen(g, s, d)) return rect(x, y, col.open, `stroke="${col.icon}" stroke-width="0.6" stroke-dasharray="1.4 1"`);
      return rect(x, y, col.icon) + `<path d="M${x + 2.6} ${y + 3.6}H${x + 7.4}M${x + 2.6} ${y + 5}H${x + 7.4}M${x + 2.6} ${y + 6.4}H${x + 7.4}" stroke="${C.ring === "#ffffff" ? "#fff" : "#0b0e19"}" stroke-width="0.55" opacity="0.8"/>`;
    }
    const b = g.plateBit[i];
    if (b >= 0) {
      const col = LINK[p.plates[b].color];
      if (s.act & (1 << b)) {
        return rect(x, y, col.open) + diamond(x, y, C.ring === "#ffffff" ? "#fff" : col.fill, col.icon) +
          `<path d="M${x + 3.7} ${y + 5.1}l1 1 1.8-2.1" stroke="${col.icon}" stroke-width="0.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      return rect(x, y, col.fill) + diamond(x, y, col.icon, C.plateEdge);
    }
    if (i === g.exit) return rect(x, y, C.exitFill) + star(x, y);
    return rect(x, y, C.floor);
  }

  function chainCell(g, p, s, i, x, y) {
    if (g.wall[i]) return rect(x, y, C.wall);
    const d = g.doorAt[i];
    if (d >= 0) {
      const req = p.doors[d].req;
      const first = KEY[req[0]] || KEY.red;
      if (s.opened & (1 << d)) return rect(x, y, first.fill, `stroke="${first.bars}" stroke-width="0.6" stroke-dasharray="1.4 1"`);
      const n = 4;
      let bars = "";
      for (let k = 0; k < n; k++) {
        const bx = x + 2.4 + (k * 5.2) / (n - 1);
        bars += `<path d="M${bx.toFixed(2)} ${y + 2.2}V${y + 7.8}" stroke="${(KEY[req[k % req.length]] || KEY.red).bars}" stroke-width="0.95" stroke-linecap="round"/>`;
      }
      return rect(x, y, first.door) + bars + `<path d="M${x + 2.2} ${y + 5}H${x + 7.8}" stroke="${first.bars}" stroke-width="0.65"/>`;
    }
    const k = g.keyAt[i];
    if (k >= 0 && s.left & (1 << k)) {
      const col = KEY[p.keys[k].color] || KEY.red;
      return rect(x, y, col.fill) + keyIcon(x, y, col.icon);
    }
    if (i === g.exit) return rect(x, y, C.exitFill) + star(x, y);
    return rect(x, y, C.floor);
  }

  function tideCell(g, p, s, i, x, y) {
    const E = root.RubiconEngines.games.tide;
    if (g.wall[i]) return rect(x, y, C.wall);
    let out;
    const z = g.zoneAt[i];
    if (z >= 0) {
      const zone = g.zones[z];
      const dry = E.dry(zone, s.t);
      out = rect(x, y, dry ? C.dry : C.flooded);
      if (!dry) out += `<path d="M${x + 1.8} ${y + 6.6}q1.1-1 2.2 0t2.2 0t2.2 0" stroke="${C.zoneWet}" stroke-width="0.5" fill="none" opacity="0.6"/>`;
      out += `<text x="${x + 8.4}" y="${y + 2.9}" font-size="2.2" text-anchor="end" font-weight="700" fill="${dry ? C.zoneDry : C.zoneWet}">${zone.id}</text>`;
    } else if (i === g.exit) {
      out = rect(x, y, C.exitFill) + star(x, y);
    } else {
      out = rect(x, y, C.floor);
    }
    const b = g.beaconAt[i];
    if (b >= 0) out += s.got & (1 << b) ? diamond(x, y, "none", C.collected, 2.2) : diamond(x, y, C.beacon, C.beaconEdge, 2.3);
    return out;
  }

  const CELL = { mosaic: mosaicCell, chain: chainCell, tide: tideCell };

  function draw(svg, key, g, p, s, opts = {}) {
    const m = opts.coords ? 7 : 0;
    svg.setAttribute("viewBox", `${-m} ${-m} ${g.w * S + m} ${g.h * S + m}`);
    if (!svg._layers) {
      svg.innerHTML = `<g class="cells"></g><g class="over"></g><g class="agent"><circle cx="5" cy="5" r="3.1" fill="${C.agent}" stroke="${C.ring}" stroke-width="1"/></g><g class="hits"></g>`;
      svg._layers = { cells: svg.firstChild, over: svg.children[1], agent: svg.children[2], hits: svg.children[3] };
      svg._painted = new Set();
      svg._sig = "";
    }
    const L = svg._layers;
    // A different puzzle: reset so the agent jumps instead of gliding.
    const sig = p.id + key;
    if (svg._sig !== sig) {
      svg._sig = sig;
      svg._painted = new Set();
      L.agent.style.transition = "none";
    }
    const fresh = new Set();
    if (key === "mosaic") {
      const E = root.RubiconEngines.games.mosaic;
      for (let i = 0; i < g.n; i++) if (E.painted(s, i) && !svg._painted.has(i)) fresh.add(i);
      svg._painted = new Set([...svg._painted, ...fresh].filter((i) => E.painted(s, i)));
    }
    let html = "";
    for (let i = 0; i < g.n; i++) {
      const [r, c] = g.rc(i);
      html += CELL[key](g, p, s, i, c * S, r * S, fresh);
    }
    if (opts.coords) {
      for (let c = 0; c < g.w; c++) html += `<text x="${c * S + 5}" y="-2.2" font-size="3" text-anchor="middle" fill="${C.coord}">${c}</text>`;
      for (let r = 0; r < g.h; r++) html += `<text x="-2.6" y="${r * S + 6}" font-size="3" text-anchor="middle" fill="${C.coord}">${r}</text>`;
    }
    L.cells.innerHTML = html;

    let over = "";
    if (opts.path && opts.path.length > 1) {
      const pts = opts.path.map((i) => g.rc(i)).map(([r, c]) => `${c * S + 5},${r * S + 5}`).join(" ");
      over += `<polyline points="${pts}" fill="none" stroke="${C.path}" stroke-width="1.1" stroke-dasharray="2 1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
    }
    for (const [i, kind] of Object.entries(opts.marks || {})) {
      const [r, c] = g.rc(+i);
      const col = kind === "right" ? C.right : kind === "wrong" ? C.wrong : C.pick;
      over += `<rect x="${c * S + 0.9}" y="${r * S + 0.9}" width="8.2" height="8.2" rx="1.4" fill="none" stroke="${col}" stroke-width="1.3"/>`;
    }
    L.over.innerHTML = over;

    const [ar, ac] = g.rc(s.pos);
    L.agent.style.transform = `translate(${ac * S}px, ${ar * S}px)`;
    if (L.agent.style.transition === "none") {
      L.agent.getBoundingClientRect();
      requestAnimationFrame(() => (L.agent.style.transition = ""));
    }
    const done = root.RubiconEngines.games[key].won(g, s);
    L.agent.querySelector("circle").setAttribute("fill", done ? C.won : C.agent);

    L.hits.innerHTML = "";
    if (opts.onCell) {
      for (let i = 0; i < g.n; i++) {
        const [r, c] = g.rc(i);
        const h = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        Object.entries({ x: c * S, y: r * S, width: S, height: S, rx: 1.2, class: "hit" }).forEach(([k, v]) => h.setAttribute(k, v));
        h.addEventListener("click", () => opts.onCell(i));
        L.hits.appendChild(h);
      }
    }
  }

  root.RubiconBoard = { draw, setTheme, get colors() { return { LINK, KEY, C }; } };
})(window);
