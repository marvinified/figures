/**
 * window-stack: four app windows standing in a cascade, one behind the next,
 * each with its title bar and three dots and what it shows: code, a photo,
 * a chat and a chart. The pointer picks the window under it, the nearest
 * first, each tested where it stands at rest; it comes to the front and takes
 * the bright edge, and the ones that were in front of it step back one place,
 * staggered on the 700ms curve. The slider is the gap between windows.
 */
const {
  Cam, fit, open, poly, proj, rrect, run, hull, circ, seg,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const WW = 84, WH = 54, T = 2, STEP = 60, N = 4;
const NAMES = ["editor", "photos", "chat", "charts"];
const POS = Array.from({ length: N }, (_, i) => ({ x0: (N - 1 - i) * 10, top: 84 - i * 12 }));

/** The direction toward the camera, from what P does to the three axes. */
function viewDir(P) {
  const o = P(0, 0, 0), e = [P(1, 0, 0), P(0, 1, 0), P(0, 0, 1)].map((p) => [p[0] - o[0], p[1] - o[1]]);
  const a = e.map((v) => v[0]), b = e.map((v) => v[1]);
  const v = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return v[2] < 0 ? v.map((c) => -c) : v;
}

/** A rounded slab: ring and inner in its own (u, v), T thick; at(u, v, t) places it. The crease is the near face's inner run that borders a side. */
function slab(P, V, at, ring, inner, T) {
  const w = (q, t) => P(...at(q.u, q.v, t)), a = at(0, 0, 0), b = at(0, 0, T);
  const tn = (b[0] - a[0]) * V[0] + (b[1] - a[1]) * V[1] + (b[2] - a[2]) * V[2] > 0 ? T : 0, tf = T - tn;
  const n0 = P(...at(0, 0, tn)), f0 = P(...at(0, 0, tf)), o = [f0[0] - n0[0], f0[1] - n0[1]];
  const keep = (q) => { const p = w(q, tn), s = P(...at(q.u + q.nu, q.v + q.nv, tn)); return (s[0] - p[0]) * o[0] + (s[1] - p[1]) * o[1] > 0.01; };
  const r = Math.hypot(o[0], o[1]) > 0.2 ? run(inner, keep) : [];
  return { sil: poly(hull(ring.map((q) => w(q, tn)).concat(ring.map((q) => w(q, tf))))), crease: r.length > 1 ? open(r.map((q) => w(q, tn))) : "", tn };
}

/** What each window shows, as strokes in its own (u, v) from its top-left corner, v down. */
function content(i) {
  const s = [];
  if (i === 0) [[4, 30], [8, 44], [8, 38], [12, 52], [8, 30], [4, 20]].forEach(([a, b], k) => s.push([[a, 15 + k * 5.5], [b, 15 + k * 5.5]]));
  if (i === 1) { s.push([[6, 13], [78, 13], [78, 49], [6, 49], [6, 13]], [[8, 46], [28, 28], [42, 40], [53, 31], [76, 46]]); s.push(circ(3.6, 14).map((q) => [64 + q.u, 22 + q.v]).concat([[67.6, 22]])); }
  if (i === 2) { s.push([[6, 14], [44, 14], [44, 22], [6, 22], [6, 14]], [[38, 27], [78, 27], [78, 35], [38, 35], [38, 27]], [[6, 40], [56, 40], [56, 48], [6, 48], [6, 40]]); }
  if (i === 3) { [[14, 8], [25, 20], [36, 14], [47, 28], [58, 22], [69, 33]].forEach(([u, h]) => s.push([[u, 49], [u, 49 - h]])); s.push([[6, 49], [78, 49]]); }
  return s;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let GAP = value, act = -1;
  let order = [0, 1, 2, 3];

  const C = Cam(45, 0.5, 2.2);
  fit(C, POS.flatMap((p) => [-3 * 20, 6].flatMap((y) => [[p.x0, y, p.top], [p.x0 + WW, y, p.top - WH]])), 200, 164);
  const P = proj(C), V = viewDir(P);

  const g = mk("g", {}, svg);
  const wins = POS.map((p, i) => {
    const el = solid(g);
    return { i, ...p, el, marks: mk("path", { class: "nf lo" }, el.g), y: tween(0), drawn: NaN, ring: rrect(0, 0, WW, WH, 4, 4), inner: rrect(1, 1, WW - 1, WH - 1, 3, 4), strokes: content(i) };
  });
  const rankY = (r) => -(N - 1 - r) * GAP;

  function draw(w, y) {
    if (y === w.drawn) return;
    w.drawn = y;
    const at = (u, v, t) => [w.x0 + u, y + t, w.top - v];
    const q = slab(P, V, at, w.ring, w.inner, T), f = (u, v) => P(...at(u, v, q.tn));
    put(w.el, q);
    const dots = [5, 9, 13].map((u) => poly(circ(1.3, 10).map((c) => f(u + c.u, 4.5 + c.v))));
    w.marks.setAttribute("d", seg(f(0.8, 9), f(WW - 0.8, 9)) + dots.join("") + w.strokes.map((s) => open(s.map(([u, v]) => f(u, v)))).join(""));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const w of wins) { draw(w, tval(w.y, now)); if (!tdone(w.y, now)) moving = true; }
    wins.slice().sort((a, b) => tval(a.y, now) - tval(b.y, now)).forEach((w) => g.appendChild(w.el.g));
    return moving;
  });
  bag.add(B.unregister);

  /** The window under the pointer where it stands at rest, the nearest first. */
  function hit([sx, sy]) {
    for (let i = N - 1; i >= 0; i--) {
      const w = wins[i], y = rankY(i), o = P(w.x0, y, w.top), ex = P(w.x0 + 1, y, w.top), ez = P(w.x0, y, w.top + 1);
      const a = ex[0] - o[0], b = ez[0] - o[0], c = ex[1] - o[1], d = ez[1] - o[1], det = a * d - b * c, rx = sx - o[0], ry = sy - o[1];
      const u = (rx * d - b * ry) / det, v = -(a * ry - c * rx) / det;
      if (u >= 0 && u <= WW && v >= 0 && v <= WH) return i;
    }
    return -1;
  }

  function apply() {
    const now = performance.now(), prev = order.slice();
    order = act < 0 ? [0, 1, 2, 3] : [0, 1, 2, 3].filter((i) => i !== act).concat([act]);
    order.forEach((i, r) => tset(wins[i].y, rankY(r), now, Math.abs(prev.indexOf(i) - r) > 0 ? (N - 1 - r) * STEP * 0.5 : 0));
    const front = order[N - 1];
    wins.forEach((w) => w.el.sil.classList.toggle("hi", w.i === front));
    read.textContent = act < 0 ? "rest" : NAMES[act];
    B.wake();
  }
  function setActive(a) { if (a === act) return; act = a; apply(); }

  wins.forEach((w, r) => { w.y = tween(rankY(r)); });
  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { GAP = v; apply(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "window-stack",
  means: "A cascade of app windows: the one under the pointer comes to the front and the others step back.",
  rules: [1, 2, 5, 9],
  range: [8, 14, 20],
  mount,
});
