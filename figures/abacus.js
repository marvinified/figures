/**
 * abacus: a counting frame standing on a foot, five rods of ten beads between
 * two posts. The pointer picks a rod by its height on the frame and a count by
 * how far along it is; that many beads slide to the left post and the rest to
 * the right, one after another from the gap outward by the slider's step, on
 * the 700ms curve. The last counted bead takes the bright edge. At rest the
 * rods hold 3, 1, 4, 1, 5 from the top.
 */
const {
  Cam, clamp, fit, poly, proj, prism, rings, seg, facing, run, hull, open, circ,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const W = 104, POST = 5, NR = 5, NB = 10, BW = 5.4, BR = 4.4, Z0 = 12, DZ = 16, H = Z0 * 2 + (NR - 1) * DZ, REST = [5, 1, 4, 1, 3];
const zOf = (r) => Z0 + r * DZ;
const beadX = (j, d) => (j < d ? POST + 0.4 + j * BW : W - POST - 0.4 - (NB - j) * BW);

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
  let STEP = value, act = null, lit = null;
  const counts = REST.slice();

  const C = Cam(45, 0.5, 2.3);
  fit(C, [0, W].flatMap((x) => [-14, 14].flatMap((y) => [[x - 4, y, -5], [x, y, H]])), 200, 166);
  const P = proj(C), V = viewDir(P), front = facing(C);
  const block = (x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, ring, inner, z0, z1)); };

  const g = mk("g", {}, svg);
  block(-6, -14, W + 6, 14, 3, 1.2, -5, 0);
  block(0, -4, POST, 4, 1.4, 0.6, 0, H);
  block(POST, -3, W - POST, 3, 1.2, 0.6, 0, 4);
  const bar = solid(g);
  put(bar, slab(P, V, (u, v, t) => [u, v, t + H - 4], rings(POST, -3, W - POST, 3, 1.2, 0.6)[0], rings(POST, -3, W - POST, 3, 1.2, 0.6)[1], 4));
  mk("path", { d: Array.from({ length: NR }, (_, r) => seg(P(POST, 0, zOf(r)), P(W - POST, 0, zOf(r)))).join(""), class: "nf" }, g);

  const ring = circ(BR, 36), inner = circ(BR - 1.1, 36);
  const rods = REST.map((d, r) => ({
    r, beads: Array.from({ length: NB }, (_, j) => ({ j, el: solid(g), x: tween(beadX(j, d)), drawn: NaN })),
  }));
  block(W - POST, -4, W, 4, 1.4, 0.6, 0, H);

  function draw(b, r, x) {
    if (x === b.drawn) return;
    b.drawn = x;
    const z = zOf(r);
    put(b.el, slab(P, V, (u, v, t) => [x + t, u, z + v], ring, inner, BW - 0.5));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const rod of rods) {
      const xs = rod.beads.map((b) => { if (!tdone(b.x, now)) moving = true; return tval(b.x, now); });
      for (let j = 0; j < NB; j++) xs[j] = Math.max(xs[j], j ? xs[j - 1] + BW : beadX(0, NB));
      for (let j = NB - 1; j >= 0; j--) xs[j] = Math.min(xs[j], j < NB - 1 ? xs[j + 1] - BW : beadX(j, 0));
      rod.beads.forEach((b, j) => draw(b, rod.r, xs[j]));
    }
    return moving;
  });
  bag.add(B.unregister);

  /** The rod and count under the pointer, read on the frame's plane: the rod by height, the count by how far along. */
  function hit([sx, sy]) {
    const o = P(0, 0, 0), ex = P(1, 0, 0), ez = P(0, 0, 1);
    const a = ex[0] - o[0], b = ez[0] - o[0], c = ex[1] - o[1], d = ez[1] - o[1], det = a * d - b * c, rx = sx - o[0], ry = sy - o[1];
    const x = (rx * d - b * ry) / det, z = (a * ry - c * rx) / det, r = Math.round((z - Z0) / DZ);
    if (r < 0 || r >= NR || x < -10 || x > W + 10) return null;
    return { r, d: clamp(Math.round(((x - POST) / (W - 2 * POST)) * NB), 0, NB) };
  }

  function apply() {
    const now = performance.now();
    rods.forEach((rod) => {
      const d = act && act.r === rod.r ? act.d : REST[rod.r];
      const prev = counts[rod.r];
      counts[rod.r] = d;
      rod.beads.forEach((b) => {
        const moved = (b.j < d) !== (b.j < prev);
        const k = b.j < Math.min(d, prev) || b.j >= Math.max(d, prev) ? 0 : d > prev ? b.j - prev : prev - 1 - b.j;
        tset(b.x, beadX(b.j, d), now, moved ? k * STEP : 0);
      });
    });
    const sel = act || { r: NR - 1, d: REST[NR - 1] }, key = sel.r + "," + Math.max(0, sel.d - 1);
    if (key !== lit) {
      lit = key;
      rods.forEach((rod) => rod.beads.forEach((b) => b.el.sil.classList.toggle("hi", rod.r === sel.r && b.j === Math.max(0, sel.d - 1))));
    }
    read.textContent = act ? `rod ${NR - act.r} · ${act.d}` : "rest";
    B.wake();
  }
  function setActive(a) {
    if ((a && act && a.r === act.r && a.d === act.d) || (!a && !act)) return;
    act = a; apply();
  }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { STEP = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "abacus",
  means: "An abacus: the pointer picks a rod and a count, and that many beads slide over one after another.",
  rules: [1, 2, 5, 9],
  range: [0, 30, 60],
  mount,
});
