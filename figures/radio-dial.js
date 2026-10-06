/**
 * radio-dial: a portable radio, a speaker grille on the left of its face and a
 * tuning window on the right, ticked from 88 to 108 with seven stations dotted
 * along it, two knobs below, a handle and a telescopic antenna on top. The pointer's place along the
 * face tunes the needle on a spring; near a station it is drawn in, and within
 * half the slider's capture it settles on the station, whose dot lights, and the tuning knob turns with
 * the needle, and the antenna draws out slowly as the signal comes in. At rest the
 * needle sits between stations, the antenna half down.
 */
const {
  Cam, clamp, fit, lerp, poly, proj, prism, rings, rrect, seg, facing, run, hull, open, circ,
  spring, stepS, mk, pointer, put, register, disposer, solid, place,
} = HL;

const X1 = 112, DY = 30, Z1 = 66, WIN = [58, 104, 36, 56], F = [88, 108], REST = 96.7, AX = [-0.34, -0.12, 0.93];
const STATIONS = [89.3, 92.1, 95.5, 98.4, 101.9, 104.3, 106.7];
const fx = (f) => lerp(WIN[0] + 4, WIN[1] - 4, (f - F[0]) / (F[1] - F[0]));

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
  let CAP = value, over = null, lit = -2;

  const C = Cam(45, 0.5, 2.15);
  fit(C, [0, X1].flatMap((x) => [-DY, 8].flatMap((y) => [[x, y, -3], [x, y, Z1 + 14]])).concat([[X1 - 8 + AX[0] * 60, -DY + 6, Z1 + AX[2] * 60]]), 200, 166);
  const P = proj(C), V = viewDir(P), front = facing(C), F0 = (x, z) => P(x, 0, z);
  const block = (x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, ring, inner, z0, z1)); };

  const g = mk("g", {}, svg);
  block(10, -DY + 6, 24, -6, 2, 1, -3, 0);
  block(X1 - 24, -DY + 6, X1 - 10, -6, 2, 1, -3, 0);
  block(0, -DY, X1, 0, 5, 1.5, 0, Z1);
  block(24, -DY / 2 - 2.5, 29, -DY / 2 + 2.5, 1.5, 0.6, Z1, Z1 + 11);
  block(X1 - 29, -DY / 2 - 2.5, X1 - 24, -DY / 2 + 2.5, 1.5, 0.6, Z1, Z1 + 11);
  block(21, -DY / 2 - 3, X1 - 21, -DY / 2 + 3, 2.4, 1, Z1 + 9, Z1 + 14);

  block(X1 - 11, -DY + 3, X1 - 5, -DY + 9, 1.5, 0.6, Z1, Z1 + 3);
  const rods = [1.9, 1.4, 1].map((w) => ({ w, el: mk("path", { class: "sil" }, g) }));
  const tip = mk("ellipse", { rx: 1.5 * C.S, ry: 1.5 * C.S, class: "sil" }, g);

  const outline = (u0, v0, u1, v1, r) => poly(rrect(u0, v0, u1, v1, r, 4).map((q) => F0(q.u, q.v)));
  const slots = [];
  for (let z = 12; z <= 54; z += 4) slots.push(seg(F0(13, z), F0(49, z)));
  mk("path", { d: outline(8, 7, 54, 59, 5) + slots.join(""), class: "nf lo" }, g);
  const ticks = [];
  for (let f = F[0]; f <= F[1]; f++) ticks.push(seg(F0(fx(f), WIN[2] + 2.5), F0(fx(f), WIN[2] + (f % 4 === 0 ? 7 : 4.5))));
  mk("path", { d: outline(WIN[0], WIN[2], WIN[1], WIN[3], 3), class: "sil" }, g);
  mk("path", { d: ticks.join("") + seg(F0(WIN[0] + 3, WIN[3] - 5), F0(WIN[1] - 3, WIN[3] - 5)), class: "nf lo" }, g);
  const dots = STATIONS.map((f) => { const d = mk("ellipse", { rx: 1.3 * C.S, ry: 1.3 * C.S, class: "dot off" }, g); place(d, F0(fx(f), WIN[3] - 5)); return d; });
  const needle = mk("path", { class: "sil hi" }, g);

  const knob = (cx, r) => {
    const q = slab(P, V, (u, v, t) => [cx + u, t, 19 + v], circ(r, 40), circ(r - 1.2, 40), 6);
    const el = solid(g); put(el, q);
    return { el, mark: mk("path", { class: "nf lo" }, el.g), at: (a, k) => P(cx + Math.cos(a) * k, q.tn, 19 + Math.sin(a) * k) };
  };
  const vol = knob(69, 8), tune = knob(93, 8);
  vol.mark.setAttribute("d", seg(vol.at(2.3, 2), vol.at(2.3, 6.5)));

  /** How strongly frequency f comes in: full on a station, none a station's width off it. */
  const signal = (f) => { const u = clamp(1 - Math.min(...STATIONS.map((s) => Math.abs(s - f))) / 1.2, 0, 1); return u * u * (3 - 2 * u); };
  const sp = spring(REST, { eps: 0.005 }), ant = spring(lerp(10, 58, signal(REST)), { k: 30, c: 11, eps: 0.05 });
  let drawn = "";
  function draw() {
    const f = sp.x, len = ant.x, key = f + "," + len;
    if (key === drawn) return;
    drawn = key;
    const x = fx(f);
    needle.setAttribute("d", poly([F0(x - 0.6, WIN[2] + 2), F0(x + 0.6, WIN[2] + 2), F0(x + 0.6, WIN[3] - 2), F0(x - 0.6, WIN[3] - 2)]));
    const a = Math.PI / 2 - (f - F[0]) * 0.3;
    tune.mark.setAttribute("d", seg(tune.at(a, 2), tune.at(a, 6.5)));
    const b = [X1 - 8, -DY + 6, Z1 + 3], A = (t) => P(b[0] + AX[0] * t, b[1] + AX[1] * t, b[2] + AX[2] * t);
    rods.forEach((r, i) => {
      const p0 = A((len * i) / 3 - (i ? 1 : 0)), p1 = A((len * (i + 1)) / 3), d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      const n = [((p0[1] - p1[1]) / d) * r.w * C.S * 0.5, ((p1[0] - p0[0]) / d) * r.w * C.S * 0.5];
      r.el.setAttribute("d", poly([[p0[0] + n[0], p0[1] + n[1]], [p1[0] + n[0], p1[1] + n[1]], [p1[0] - n[0], p1[1] - n[1]], [p0[0] - n[0], p0[1] - n[1]]]));
    });
    place(tip, A(len));
    const k = STATIONS.findIndex((s) => Math.abs(s - f) < 0.08);
    if (k !== lit) { lit = k; dots.forEach((d, i) => d.setAttribute("class", i === k ? "dot" : "dot off")); }
  }

  const B = register(stage, (dt) => { const m = stepS(sp, dt) | stepS(ant, dt); draw(); return !!m; });
  bag.add(B.unregister);

  /** The face point under the pointer, on the plane y = 0, as (x, z). */
  function onFace([sx, sy]) {
    const o = P(0, 0, 0), ex = P(1, 0, 0), ez = P(0, 0, 1);
    const a = ex[0] - o[0], b = ez[0] - o[0], c = ex[1] - o[1], d = ez[1] - o[1], det = a * d - b * c, rx = sx - o[0], ry = sy - o[1];
    return [(rx * d - b * ry) / det, (a * ry - c * rx) / det];
  }

  function retarget() {
    let f = REST;
    if (over !== null) {
      f = clamp(F[0] + ((over - WIN[0] - 4) / (WIN[1] - WIN[0] - 8)) * (F[1] - F[0]), F[0], F[1]);
      const s = STATIONS.reduce((a, b) => (Math.abs(b - f) < Math.abs(a - f) ? b : a));
      const c1 = Math.min(CAP * 1.5, 1.2), c0 = Math.min(CAP * 0.5, c1 - 0.2), u = clamp((Math.abs(s - f) - c0) / (c1 - c0), 0, 1);
      f = s + (f - s) * u * u * (3 - 2 * u);
    }
    sp.t = f;
    ant.t = lerp(10, 58, signal(f));
    read.textContent = over === null ? "rest" : f.toFixed(1);
    B.wake();
  }

  retarget();
  bag.add(pointer(stage, {
    move: (p) => { const [x, z] = onFace(p); over = x > -10 && x < X1 + 10 && z > -10 && z < Z1 + 20 ? lerp(WIN[0] - 2, WIN[1] + 2, clamp(x / X1, 0, 1)) : null; retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { CAP = v; retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "radio-dial",
  means: "A portable radio: the pointer tunes the needle along the dial, and near a station it settles on it and the antenna draws out.",
  rules: [3, 5, 8],
  range: [0.3, 0.7, 1.2],
  mount,
});
