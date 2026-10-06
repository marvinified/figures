/**
 * pulley-weights: a pulley wheel on a post and arm over a base, a cord over
 * it and a weight on each end, a tall block on the left and a stack of three
 * discs on the right. One cord, so what one weight gains the other gives up.
 * The pointer takes either weight by its side and raises or lowers it by its
 * height; the other moves the opposite way on the same spring, and the wheel
 * turns between them. The slider is the cord's travel. The read-out is the
 * split between the two, left first. At rest the left weight hangs low, bright.
 */
const {
  Cam, clamp, fit, open, proj, prism, rings, circ, seg, run, hull, poly, facing, spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const RW = 18, ZLOW = 18, TALL = 17, REST = 0.28, TMAX = 36;

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
  let TRAVEL = value, side = 0;
  const ZC = ZLOW + TMAX + RW + 5, s = spring(REST, { eps: 0.002 });

  const C = Cam(45, 0.5, 2.45);
  fit(C, [[-34, -18, -4], [34, 12, -4], [-34, 12, -4], [34, -18, -4], [0, -12, ZC + RW + 3], [-RW - 7, 7, ZLOW - TALL], [RW + 7, 7, ZLOW - TALL]], 200, 166);
  const P = proj(C), V = viewDir(P), front = facing(C);
  const block = (x0, y0, x1, y1, r, b, z0, z1, el = solid(g)) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); put(el, prism(P, front, ring, inner, z0, z1)); return el; };

  const g = mk("g", {}, svg);
  block(-34, -18, 34, 12, 4, 1.4, -4, 0);
  block(-2.5, -14.5, 2.5, -9.5, 1.2, 0.5, 0, ZC + 2);
  block(-2, -12, 2, -1.5, 1, 0.5, ZC - 2, ZC + 2);
  const cords = mk("path", { class: "nf" }, g);
  const wheel = solid(g), spokes = mk("path", { class: "nf lo" }, wheel.g);
  const left = solid(g), right = { discs: [0, 1, 2].map(() => solid(g)) };

  let drawn = NaN;
  function draw() {
    const f = s.x;
    if (f === drawn) return;
    drawn = f;
    const zl = ZLOW + f * TRAVEL, zr = ZLOW + (1 - f) * TRAVEL;
    const q = slab(P, V, (u, v, t) => [u, -1.6 + t, ZC + v], circ(RW, 64), circ(RW - 1.4, 64), 3.4);
    put(wheel, q);
    const a = (f * TRAVEL) / RW, on = (r, b) => P(Math.cos(b) * r, -1.6 + q.tn, ZC + Math.sin(b) * r);
    spokes.setAttribute("d", [0, 1, 2].map((k) => seg(on(2.6, a + (k * 2 * Math.PI) / 3), on(RW - 2.6, a + (k * 2 * Math.PI) / 3))).join("") + poly(circ(2.2, 16).map((c) => on(Math.hypot(c.u, c.v), Math.atan2(c.v, c.u)))));
    cords.setAttribute("d", seg(P(-RW + 0.4, 0, ZC), P(-RW + 0.4, 0, zl)) + seg(P(RW - 0.4, 0, ZC), P(RW - 0.4, 0, zr)));
    block(-RW - 5, -5, -RW + 5.8, 5, 2.2, 1, zl - TALL, zl, left);
    right.discs.forEach((d, k) => { const [ring, inner] = [circ(7 - k * 0.8, 32), circ(6 - k * 0.8, 32)]; put(d, prism(P, front, ring.map((p) => ({ ...p, u: p.u + RW - 0.4 })), inner.map((p) => ({ ...p, u: p.u + RW - 0.4 })), zr - (3 - k) * 4.2, zr - (2 - k) * 4.2 - 0.4)); });
  }

  const B = register(stage, (dt) => { const m = stepS(s, dt); draw(); return m; });
  bag.add(B.unregister);

  /** The point under the pointer on the plane the cords hang in, as (x, z). */
  function onPlane([sx, sy]) {
    const o = P(0, 0, 0), ex = P(1, 0, 0), ez = P(0, 0, 1);
    const a = ex[0] - o[0], b = ez[0] - o[0], c = ex[1] - o[1], d = ez[1] - o[1], det = a * d - b * c, rx = sx - o[0], ry = sy - o[1];
    return [(rx * d - b * ry) / det, (a * ry - c * rx) / det];
  }

  function aim(p) {
    side = 0;
    let f = REST;
    if (p) {
      const [x, z] = onPlane(p), lift = clamp((z - ZLOW + TALL / 2) / TRAVEL, 0, 1);
      if (Math.abs(x) < 38 && z > -6 && z < ZC + RW) { side = x < 0 ? -1 : 1; f = side < 0 ? lift : 1 - lift; }
    }
    s.t = f;
    left.sil.classList.toggle("hi", side <= 0);
    right.discs.forEach((d) => d.sil.classList.toggle("hi", side > 0));
    const l = Math.round(f * 100);
    read.textContent = side === 0 ? "rest" : `${l} : ${100 - l}`;
    B.wake();
  }

  aim(null);
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { TRAVEL = v; drawn = NaN; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "pulley-weights",
  means: "Two weights on one cord over a pulley: raise one and the other comes down by just as much.",
  rules: [1, 3, 8],
  range: [18, 28, 36],
  mount,
});
