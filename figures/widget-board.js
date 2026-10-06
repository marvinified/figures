/**
 * widget-board: a dashboard, seven widget tiles of mixed sizes packed on one board,
 * each lid carrying its widget: bars, a ring, a list, a trend line. At rest
 * the tiles stand at uneven heights, the big chart bright. The pointer picks
 * the tile under it (each tested on its resting lid, the nearest winning);
 * it lifts and takes the bright edge, and the others settle down, staggered
 * outwards from it by distance. The slider is the lift.
 */
const {
  Cam, clamp, facing, fit, open, poly, prism, proj, rings, rrect, seg, unproj,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const U = 24, GP = 3, STEP = 45;
const TILES = [
  [0, 0, 2, 1, "bars", 7], [2, 0, 1, 1, "ring", 4], [3, 0, 1, 2, "list", 5], [0, 1, 1, 2, "list", 3],
  [1, 1, 2, 1, "trend", 6], [1, 2, 1, 1, "ring", 3.5], [2, 2, 2, 1, "bars", 4.5],
];
const X1 = 4 * U, Y1 = 3 * U;

/** The widget drawn on a lid, in the tile's own box: what makes it a dashboard. */
function widget(P, kind, x0, y0, x1, y1, z) {
  const w = (x, y) => P(x, y, z), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (kind === "bars") {
    const n = 5, bw = (x1 - x0 - 10) / n, hs = [0.4, 0.7, 0.5, 0.9, 0.6];
    return hs.map((h, k) => { const bx = x0 + 5 + k * bw; return poly([w(bx + 1, y1 - 4), w(bx + bw - 1, y1 - 4), w(bx + bw - 1, y1 - 4 - h * (y1 - y0 - 8)), w(bx + 1, y1 - 4 - h * (y1 - y0 - 8))]); }).join("");
  }
  if (kind === "ring") return poly(rrect(cx - 6, cy - 6, cx + 6, cy + 6, 6, 5).map((q) => w(q.u, q.v))) + poly(rrect(cx - 3, cy - 3, cx + 3, cy + 3, 3, 4).map((q) => w(q.u, q.v)));
  if (kind === "list") return [0, 1, 2, 3, 4].filter((k) => y0 + 6 + k * 8 < y1 - 4).map((k) => seg(w(x0 + 4, y0 + 6 + k * 8), w(x1 - 6, y0 + 6 + k * 8))).join("");
  const pts = [0, 0.5, 0.3, 0.8, 0.6, 1].map((t, k) => w(x0 + 5 + (k * (x1 - x0 - 10)) / 5, y1 - 5 - t * (y1 - y0 - 10)));
  return open(pts);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let LIFT = value, act = -1;

  const C = Cam(45, 0.5, 2.15);
  fit(C, [[-8, -8, -5], [X1 + 8, Y1 + 8, -5], [X1 + 8, -8, -5], [-8, Y1 + 8, -5], [0, 0, 32], [X1, 0, 32]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [br, bi] = rings(-8, -8, X1 + 8, Y1 + 8, 9, 2);
  put(solid(g), prism(P, front, br, bi, -5, 0));

  const tiles = TILES.map(([c, r, w, h, kind, h0], i) => {
    const x0 = c * U + GP / 2, y0 = r * U + GP / 2, x1 = (c + w) * U - GP / 2, y1 = (r + h) * U - GP / 2;
    const [ring, inner] = rings(x0, y0, x1, y1, 3.5, 1.2);
    return { i, kind, h0, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, ring, inner, tw: tween(h0), lz: tween(0), drawn: "" };
  });
  const order = tiles.slice().sort((a, b) => a.cx + a.cy - (b.cx + b.cy));
  order.forEach((t) => { t.el = solid(g); t.mark = mk("path", { class: "nf lo" }, t.el.g); });

  function draw(t, h, z) {
    const key = h.toFixed(2) + "," + z.toFixed(2);
    if (key === t.drawn) return;
    t.drawn = key;
    put(t.el, prism(P, front, t.ring, t.inner, z, z + h));
    t.mark.setAttribute("d", widget(P, t.kind, t.x0, t.y0, t.x1, t.y1, z + h));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const t of tiles) { draw(t, tval(t.tw, now), tval(t.lz, now)); if (!tdone(t.tw, now) || !tdone(t.lz, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  function hit([sx, sy]) {
    let best = -1, bk = -Infinity;
    for (const t of tiles) for (let z = t.h0; z >= 0; z -= 1.5) {
      const [x, y] = unproj(C, sx, sy, z);
      if (x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1) { if (t.cx + t.cy > bk) { bk = t.cx + t.cy; best = t.i; } break; }
    }
    return best;
  }

  function apply() {
    const now = performance.now(), a = tiles[act];
    for (const t of tiles) {
      const d = a ? Math.hypot(t.cx - a.cx, t.cy - a.cy) / U : 0;
      tset(t.tw, !a || t === a ? t.h0 : clamp(t.h0 * 0.4, 1.5, 3), now, d * STEP);
      tset(t.lz, t === a ? LIFT : 0, now, d * STEP);
      t.el.sil.classList.toggle("hi", a ? t === a : t.i === 0);
    }
    // a lifted tile is above them all, so it is painted last
    order.forEach((t) => g.appendChild(t.el.g));
    if (a) g.appendChild(a.el.g);
    read.textContent = a ? `tile ${act + 1}` : "rest";
    B.wake();
  }
  function setActive(k) { if (k !== act) { act = k; apply(); } }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { LIFT = v; if (act >= 0) apply(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "widget-board",
  means: "A dashboard of widget tiles: the one under the pointer lifts out of the board and the rest settle down.",
  rules: [1, 2, 5, 9],
  range: [6, 14, 22],
  mount,
});
