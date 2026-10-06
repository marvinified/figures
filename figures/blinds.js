/**
 * blinds: a venetian blind in a window frame, sixteen slats on two ladder
 * cords between a headrail and a bottom rail, a tilt wand hanging at one end.
 * The pointer's height, read on the window's plane, opens the slats near it on
 * their own springs, the nearest flat open and the far ones shut, as far as
 * the slider's radius reaches. At rest a band near the top stands open. The
 * nearest slat takes the bright edge.
 */
const {
  Cam, clamp, fit, hull, lerp, open, poly, prism, proj, rings, rrect, run, seg, facing, rad,
  spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const N = 16, L = 116, GAP = 6.4, DW = 5.2, T = 0.7, Z1 = 8 + N * GAP, SHUT = -74, OPEN = -4;
const REST = (k) => 0.1 + 0.8 * Math.exp(-(((k - 4) / 2.4) ** 2));

/** The share of open at u radii from the pointer: 1 → .3 at 45% → .05 at the edge and beyond. */
const falloff = (u) => (u <= 0.45 ? 1 - (u / 0.45) * 0.7 : u <= 1 ? 0.3 - ((u - 0.45) / 0.55) * 0.25 : 0.05);

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

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let R = value, over = null, lit = -1;

  const C = Cam(45, 0.5, 1.8);
  fit(C, [-10, L + 10].flatMap((x) => [-14, 10].flatMap((y) => [[x, y, -6], [x, y, Z1 + 14]])), 200, 166);
  const P = proj(C), V = viewDir(P), front = facing(C);
  const at0 = (x, z) => P(x, -12, z);

  const g = mk("g", {}, svg);
  // the window behind: its frame as one plate, the glass's cross bars drawn on it
  const frame = slab(P, V, (u, v, t) => [u, -14 + t, v], rrect(-10, -6, L + 10, Z1 + 14, 3, 5), rrect(-8.5, -4.5, L + 8.5, Z1 + 12.5, 2, 5), 3);
  mk("path", { d: frame.sil, class: "sil" }, g);
  mk("path", { d: frame.crease, class: "nf lo" }, g);
  mk("path", { d: poly(rrect(-4, 0, L + 4, Z1 + 8, 1.5, 4).map((q) => at0(q.u, q.v))) + seg(at0(L / 2, 0), at0(L / 2, Z1 + 8)) + seg(at0(-4, Z1 / 2 + 4), at0(L + 4, Z1 / 2 + 4)), class: "nf lo" }, g);
  // the ladder cords, behind the slats they carry
  mk("path", { d: [18, L - 18].map((x) => seg(P(x, 0, 2), P(x, 0, Z1))).join(""), class: "nf lo" }, g);

  const block = (x0, y0, x1, y1, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, 1.5, 0.8); put(solid(g), prism(P, front, ring, inner, z0, z1)); };
  block(-1, -3, L + 1, 3, 0, 2.6);

  // bottom to top: a higher slat is nearer the camera, and a shut one laps over the one below
  const ring = rrect(0, -DW, L, DW, 1.6, 4), inner = rrect(0.8, -DW + 0.8, L - 0.8, DW - 0.8, 1, 4);
  const slats = [];
  for (let k = N - 1; k >= 0; k--) {
    const el = solid(g);
    slats.push({ k, z: Z1 - 4 - k * GAP, el, sp: spring(REST(k), { eps: 0.002 }), drawn: NaN });
  }
  block(-3, -6, L + 3, 6, Z1, Z1 + 8);
  const wand = solid(g);
  { const [wr, wi] = rings(L - 6, 6, L - 4.4, 7.6, 0.8, 0.3); put(wand, prism(P, front, wr, wi, Z1 - 58, Z1)); }

  function draw(s) {
    const f = clamp(s.sp.x, 0, 1);
    if (f === s.drawn) return;
    s.drawn = f;
    const th = rad(lerp(SHUT, OPEN, f)), c = Math.cos(th), sn = Math.sin(th);
    const q = slab(P, V, (u, v, t) => [u, v * c - t * sn, s.z + v * sn + t * c], ring, inner, T);
    s.el.sil.setAttribute("d", q.sil);
    s.el.cr.setAttribute("d", q.crease);
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const s of slats) { if (stepS(s.sp, dt)) m = true; draw(s); }
    return m;
  });
  bag.add(B.unregister);

  /** The slat index under a screen point, as a continuous number, from the window's plane. */
  function slatAt([sx, sy]) {
    const o = P(0, 0, 0), ex = P(1, 0, 0), ez = P(0, 0, 1);
    const a = ex[0] - o[0], b = ez[0] - o[0], c = ex[1] - o[1], d = ez[1] - o[1], rx = sx - o[0], ry = sy - o[1];
    const x = (rx * d - b * ry) / (a * d - b * c), z = (a * ry - c * rx) / (a * d - b * c);
    return x < -12 || x > L + 12 || z < -6 || z > Z1 + 10 ? null : (Z1 - 4 - z) / GAP;
  }

  function retarget() {
    for (const s of slats) s.sp.t = over === null ? REST(s.k) : falloff(Math.abs(s.k - over) / R);
    const k = over === null ? 4 : clamp(Math.round(over), 0, N - 1);
    if (k !== lit) { lit = k; slats.forEach((s) => s.el.sil.classList.toggle("hi", s.k === k)); }
    read.textContent = over === null ? "rest" : `slat ${String(k + 1).padStart(2, "0")}`;
    B.wake();
  }

  retarget();
  bag.add(pointer(stage, { move: (p) => { over = slatAt(p); retarget(); }, leave: () => { over = null; retarget(); } }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v; retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "blinds",
  means: "A venetian blind: the slats open where the pointer is and stay shut further away.",
  rules: [1, 3, 5, 9],
  range: [2, 4, 7],
  mount,
});
