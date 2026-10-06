/**
 * balance-scale: a beam balance on a column and foot, a pan hung on three
 * strings from each end, a stacked 60 g weight on the left pan and a 40 g
 * block on the right, a needle hanging from the pivot over a dial of ticks on
 * the column,
 * and a 40 g rider on the beam. The rider follows the pointer anywhere along
 * the beam; the beam swings toward the heavier side on a loose spring, past
 * level and back before it settles, easing off toward the slider's angle, and
 * the pans ride up and down with it. The read-out is the right side's surplus;
 * 0 g is level, the rider half way out on the right. At rest the rider sits
 * near the pivot and the beam leans left.
 */
const {
  Cam, clamp, fit, poly, proj, prism, rings, seg, facing, run, hull, open, circ, rad,
  spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const Z0 = 74, ARM = 54, HANG = 30, PR = 13, UMAX = 48, LEFT = 60, RIGHT = 40, RIDER = 40, REST = 6, GAIN = 0.7;
/** The right side's surplus in grams, the rider at u counted at the pan's arm. */
const surplus = (u) => RIGHT + (RIDER * u) / ARM - LEFT;

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

const shift = (ring, x, y) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let MAX = value, over = null;

  const C = Cam(45, 0.5, 2.05);
  fit(C, [-1, 1].flatMap((s) => [[s * (ARM + PR), s * PR, Z0 - HANG - 14], [s * (ARM + PR), -s * PR, Z0 + 20], [0, s * 16, 0]]), 200, 162);
  const P = proj(C), V = viewDir(P), front = facing(C);

  const g = mk("g", {}, svg);
  /** A pan on its strings, with what it carries: built in a group so it paints as one. */
  function pan(load) {
    const pg = mk("g", {}, g);
    return { pan: solid(pg), load: load.map(() => solid(pg)), strings: mk("path", { class: "nf" }, pg), spec: load };
  }
  const L = pan([[circ(5.5, 32), 0, 6.5], [circ(4, 32), 6.5, 11], [circ(1.6, 16), 11, 13]]);
  { const [ring, inner] = rings(-26, -15, 26, 15, 4, 1.2); put(solid(g), prism(P, front, ring, inner, 0, 5)); }
  { const [ring, inner] = rings(-3, -3, 3, 3, 1.4, 0.6); put(solid(g), prism(P, front, ring, inner, 5, Z0 - 3)); }
  const ticks = [];
  { const [ring, inner] = rings(-13, Z0 - 33.5, 13, Z0 - 23.5, 2.5, 0.8); put(solid(g), slab(P, V, (u, v, t) => [u, 3 + t, v], ring, inner, 1.2)); }
  for (let k = -4; k <= 4; k++) { const a = rad(-90 + k * 5), r1 = k === 0 ? 31 : k % 2 ? 28.5 : 30; ticks.push(seg(P(Math.cos(a) * 27, 4.3, Z0 + Math.sin(a) * 27), P(Math.cos(a) * r1, 4.3, Z0 + Math.sin(a) * r1))); }
  const arc = Array.from({ length: 17 }, (_, k) => { const a = rad(-90 - 20 + k * 2.5); return P(Math.cos(a) * 27, 4.3, Z0 + Math.sin(a) * 27); });
  mk("path", { d: ticks.join("") + open(arc), class: "nf" }, g);
  const beam = solid(g), needle = mk("path", { class: "sil" }, g), rider = solid(g), hub = solid(g);
  const [cube, cubeIn] = rings(-5, -5, 5, 5, 1.2, 0.8);
  const R = pan([[cube, 0, 10]]);
  R.spec[0].push(cubeIn);
  rider.sil.classList.add("hi");

  // loose on purpose: a beam balance swings past level before it settles
  const tilt = spring(0, { k: 26, c: 4.4, eps: 0.0005 }), ru = spring(REST, { k: 140, c: 22, eps: 0.02 });
  let drawn = "";

  function hang(p, side, b) {
    const ex = side * ARM * Math.cos(b), ez = Z0 + side * ARM * Math.sin(b), z = ez - HANG;
    put(p.pan, prism(P, front, shift(circ(PR, 48), ex, 0), shift(circ(PR - 1.2, 48), ex, 0), z - 2, z));
    p.spec.forEach(([ring, z0, z1, inner], i) => put(p.load[i], prism(P, front, shift(ring, ex, 0), inner ? shift(inner, ex, 0) : null, z + z0, z + z1)));
    p.strings.setAttribute("d", [90, 210, 330].map((a) => seg(P(ex + Math.cos(rad(a)) * (PR - 1), Math.sin(rad(a)) * (PR - 1), z), P(ex, 0, ez))).join(""));
  }

  function draw() {
    const b = tilt.x, u = ru.x, key = b.toFixed(5) + "," + u.toFixed(3);
    if (key === drawn) return;
    drawn = key;
    const c = Math.cos(b), s = Math.sin(b), on = (u0, v, t) => [u0 * c - v * s, t, Z0 + u0 * s + v * c];
    hang(L, -1, b); hang(R, 1, b);
    put(beam, slab(P, V, (x, v, t) => on(x, v, t - 2.2), rings(-ARM - 3, -2.2, ARM + 3, 2.2, 1.6, 0.6)[0], rings(-ARM - 3, -2.2, ARM + 3, 2.2, 1.6, 0.6)[1], 4.4));
    put(rider, slab(P, V, (x, v, t) => on(x, v, t - 3.4), rings(u - 2.6, 1.4, u + 2.6, 6.4, 1, 0.6)[0], rings(u - 2.6, 1.4, u + 2.6, 6.4, 1, 0.6)[1], 6.8));
    put(hub, slab(P, V, (x, v, t) => on(x, v, t - 3), circ(3.4, 28), circ(2.4, 28), 6));
    const n0 = on(-0.9, -3, 4.6), n1 = on(0.9, -3, 4.6), n2 = on(0.3, -30, 4.6), n3 = on(-0.3, -30, 4.6);
    needle.setAttribute("d", poly([n0, n1, n2, n3].map((p) => P(...p))));
  }

  const B = register(stage, (dt) => {
    const m = stepS(ru, dt);
    tilt.t = rad(-MAX * Math.tanh((surplus(ru.x) * GAIN) / MAX));
    const n = stepS(tilt, dt);
    draw();
    return m || n;
  });
  bag.add(B.unregister);

  /** The beam's x under the pointer, on the plane the beam swings in. */
  function onPlane([sx, sy]) {
    const o = P(0, 0, 0), ex = P(1, 0, 0), ez = P(0, 0, 1);
    const a = ex[0] - o[0], b = ez[0] - o[0], c = ex[1] - o[1], d = ez[1] - o[1], det = a * d - b * c, rx = sx - o[0], ry = sy - o[1];
    return [(rx * d - b * ry) / det, (a * ry - c * rx) / det];
  }

  function retarget() {
    ru.t = over === null ? REST : clamp(over, -UMAX, UMAX);
    const w = Math.round(surplus(ru.t));
    read.textContent = over === null ? "rest" : `${w > 0 ? "+" : ""}${w} g`;
    B.wake();
  }

  retarget();
  bag.add(pointer(stage, {
    move: (p) => { const [x, z] = onPlane(p); over = Math.abs(x) < ARM + PR + 10 && z > -10 && z < Z0 + 30 ? x : null; retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { MAX = v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "balance-scale",
  means: "A beam balance: the pointer slides the rider along the beam and the beam swings toward the heavier side.",
  rules: [3, 5, 8],
  range: [6, 12, 18],
  mount,
});
