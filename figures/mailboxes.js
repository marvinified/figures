/**
 * mailboxes: a bank of twelve mailboxes on a plinth, four across and three
 * high, each door with its name slot and keyhole, hinged on the left. The
 * pointer picks the door under it, tested on the closed doors' plane; it swings
 * open on what was delivered, and the doors beside it rattle ajar, staggered
 * outwards. At rest one door stands ajar on a letter, bright. The slider is
 * how far the picked door opens, in degrees.
 */
const {
  Cam, clamp, fit, hull, open, poly, prism, proj, rings, rrect, run, seg, facing, rad,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const NC = 4, NR = 3, CWD = 24, RHT = 25, M = 4, FOOT = 8, T = 1.4, STEP = 50, REST = 5, AJAR = [1, 0.1];
const W = M * 2 + NC * CWD - 3, H = FOOT + NR * RHT + M, DEP = 26;
const MAIL = new Set([1, 5, 6, 7, 10]);

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

/** The point (x, z) on the wall y = 0 under a screen point. */
function onWall(P, sx, sy) {
  const o = P(0, 0, 0), ex = P(1, 0, 0), ez = P(0, 0, 1);
  const a = ex[0] - o[0], b = ez[0] - o[0], c = ex[1] - o[1], d = ez[1] - o[1], det = a * d - b * c, rx = sx - o[0], ry = sy - o[1];
  return [(rx * d - b * ry) / det, (a * ry - c * rx) / det];
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let OPEN = value, act = -1;

  const C = Cam(45, 0.5, 2.2);
  fit(C, [[-5, -DEP - 4, -4], [W + 5, 4, -4], [W + 5, -DEP - 4, -4], [-5, 4, -4], [0, -DEP, H + 4], [W, -DEP, H + 4], [M, CWD, FOOT]], 200, 166);
  const P = proj(C), V = viewDir(P), front = facing(C);
  const block = (x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, ring, inner, z0, z1)); };
  const wall = (pts) => poly(pts.map(([x, z]) => P(x, 0.05, z)));

  const g = mk("g", {}, svg);
  block(-5, -DEP - 4, W + 5, 4, 3, 1.4, -4, 0);
  block(0, -DEP, W, 0, 2, 1.2, 0, H);
  block(-2, -DEP - 2, W + 2, 2, 2, 1, H, H + 4);
  mk("path", { d: wall([[M, 3], [W - M, 3], [W - M, 4.4], [M, 4.4]]), class: "nf lo" }, g);

  // each opening, and what was delivered behind it, drawn before any door
  const doors = [];
  for (let c = 0; c < NC; c++) for (let r = NR - 1; r >= 0; r--) {
    const x0 = M + c * CWD, z0 = FOOT + r * RHT, w = CWD - 3, h = RHT - 3, n = c * NR + (NR - 1 - r);
    mk("path", { d: wall(rrect(x0 + 1, z0 + 1, x0 + w - 1, z0 + h - 1, 1.5, 3).map((q) => [q.u, q.v])), class: "nf lo" }, g);
    if (MAIL.has(n)) {
      const ex = (u, v) => P(x0 + u, -4, z0 + v);
      mk("path", { d: poly([ex(3, 2), ex(w - 4, 2), ex(w - 4, 13), ex(3, 13)]) + open([ex(3, 13), ex(w / 2 - 0.5, 7), ex(w - 4, 13)]), class: "nf" }, g);
    }
    doors.push({ n, c, r, x0, z0, w, h });
  }
  doors.forEach((d) => {
    d.el = solid(g); d.marks = mk("path", { class: "nf lo" }, d.el.g); d.a = tween(0); d.drawn = NaN;
    d.ring = rrect(0, d.z0, d.w, d.z0 + d.h, 2, 4); d.inner = rrect(0.9, d.z0 + 0.9, d.w - 0.9, d.z0 + d.h - 0.9, 1.2, 4);
  });

  function draw(d, deg) {
    if (deg === d.drawn) return;
    d.drawn = deg;
    const s = Math.sin(rad(deg)), c = Math.cos(rad(deg));
    const at = (u, v, t) => [d.x0 + u * c - t * s, u * s + t * c, v];
    const q = slab(P, V, at, d.ring, d.inner, T);
    d.el.sil.setAttribute("d", q.sil);
    d.el.cr.setAttribute("d", q.crease);
    const on = (u, v) => P(...at(u, v, T));
    const slot = poly(rrect(4, d.z0 + d.h - 7, d.w - 4, d.z0 + d.h - 3.5, 1.2, 3).map((p) => on(p.u, p.v)));
    const key = poly(rrect(d.w - 4.6, d.z0 + d.h / 2 - 2.6, d.w - 2.6, d.z0 + d.h / 2 - 0.6, 1, 3).map((p) => on(p.u, p.v)));
    d.marks.setAttribute("d", q.tn === T ? slot + key : "");
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const d of doors) { draw(d, tval(d.a, now)); if (!tdone(d.a, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The door whose closed face holds the point, on the wall's plane; -1 off the bank. */
  function hit([sx, sy]) {
    const [x, z] = onWall(P, sx, sy);
    const d = doors.find((d) => x >= d.x0 - 1.5 && x <= d.x0 + d.w + 1.5 && z >= d.z0 - 1.5 && z <= d.z0 + d.h + 1.5);
    return d ? d.n : -1;
  }

  function apply(from) {
    const now = performance.now(), a = doors.find((d) => d.n === (act < 0 ? REST : act)), f = doors.find((d) => d.n === from) || a;
    for (const d of doors) {
      const k = Math.abs(d.c - a.c) + Math.abs(d.r - a.r);
      const to = act < 0 ? (d === a ? 34 : 0) : OPEN * (AJAR[k] || 0);
      tset(d.a, to, now, Math.hypot(d.c - f.c, d.r - f.r) * STEP);
      d.el.sil.classList.toggle("hi", d === a);
    }
    read.textContent = act < 0 ? "rest" : `box ${String(act + 1).padStart(2, "0")}`;
    B.wake();
  }
  function setActive(n) { if (n === act) return; const from = n >= 0 ? n : act; act = n; apply(from); }

  apply(REST);
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { OPEN = clamp(v, 0, 130); apply(act < 0 ? REST : act); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "mailboxes",
  means: "A bank of mailboxes: the door under the pointer swings open on what was delivered, and its neighbours rattle ajar.",
  rules: [1, 2, 5, 6],
  range: [70, 100, 125],
  mount,
});
