/**
 * swatch-fan: a fan deck of twelve colour strips standing on one rivet, spread
 * over a half turn and stacked, each strip ruled into five chips. The pointer
 * picks the strip whose resting angle is nearest its own about the rivet; it
 * lifts to the top and slides out along itself, and the strips either side
 * part from it by the slider's angle, staggered outwards on the 700ms curve.
 * At rest one strip stands out of the deck, bright.
 */
const {
  Cam, fit, proj, rad, rrect, seg, hull, poly, open, run, circ, tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const N = 12, U0 = -7, U1 = 72, HW = 6.5, T = 1, DZ = 1.25, A0 = 14, A1 = 166, REST = 7, OUT = 11, LIFT = 3, STEP = 40;
const CHIPS = [16, 27, 38, 49, 60];
const restA = (i) => rad(A0 + ((A1 - A0) * i) / (N - 1));

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
  let PART = value, act = -1;

  const C = Cam(45, 0.5, 2.1);
  const box = [[-8, 0, -10], [8, N * DZ + LIFT + 4, -10]];
  for (let a = A0 - 20; a <= A1 + 20; a += 6) box.push([Math.cos(rad(a)) * (U1 + OUT + 2), 0, Math.sin(rad(a)) * (U1 + OUT + 2)]);
  fit(C, box, 200, 170);
  const P = proj(C), V = viewDir(P);

  const g = mk("g", {}, svg);
  const ring = rrect(U0, -HW, U1, HW, 2.4, 4), inner = rrect(U0 + 0.9, -HW + 0.9, U1 - 0.9, HW - 0.9, 1.5, 4);
  const pin = (r, y0, T) => { const q = slab(P, V, (u, v, t) => [u, y0 + t, v], circ(r, 32), circ(r - 0.9, 32), T); const el = solid(g); put(el, q); return el; };
  pin(3.4, -2.2, 2.2);
  const strips = [];
  for (let i = 0; i < N; i++) {
    const el = solid(g);
    strips.push({ i, el, marks: mk("path", { class: "nf lo" }, el.g), a: tween(restA(i)), s: tween(0), z: tween(i * DZ), drawn: "" });
  }
  const rivet = pin(3.4, N * DZ + LIFT + T, 2.2);

  function draw(st, a, s, z) {
    const key = a.toFixed(4) + "," + s.toFixed(3) + "," + z.toFixed(3);
    if (key === st.drawn) return;
    st.drawn = key;
    const c = Math.cos(a), sn = Math.sin(a);
    const place = (u, v, t) => [(u + s) * c - v * sn, z + t, (u + s) * sn + v * c];
    const q = slab(P, V, place, ring, inner, T);
    put(st.el, q);
    const at = (u, v) => P(...place(u, v, q.tn));
    st.marks.setAttribute("d", CHIPS.map((u) => seg(at(u, -HW + 0.9), at(u, HW - 0.9))).join(""));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const st of strips) { draw(st, tval(st.a, now), tval(st.s, now), tval(st.z, now)); if (!tdone(st.a, now) || !tdone(st.s, now) || !tdone(st.z, now)) moving = true; }
    strips.slice().sort((a, b) => tval(a.z, now) - tval(b.z, now)).forEach((st) => g.insertBefore(st.el.g, rivet.g));
    return moving;
  });
  bag.add(B.unregister);

  /** The strip whose resting angle about the rivet is nearest the pointer's, on the plane the deck stands in. */
  function hit([sx, sy]) {
    const o = P(0, 0, 0), ex = P(1, 0, 0), ez = P(0, 0, 1);
    const p = ex[0] - o[0], q = ez[0] - o[0], m = ex[1] - o[1], n = ez[1] - o[1], det = p * n - q * m, rx = sx - o[0], ry = sy - o[1];
    const x = (rx * n - q * ry) / det, z = (p * ry - m * rx) / det, r = Math.hypot(x, z);
    if (r < 6 || r > U1 + OUT + 6) return -1;
    const a = Math.atan2(z, x);
    if (a < restA(0) - rad(20) || a > restA(N - 1) + rad(20)) return -1;
    let best = 0;
    strips.forEach((st, i) => { if (Math.abs(a - restA(i)) < Math.abs(a - restA(best))) best = i; });
    return best;
  }

  function apply(from) {
    const now = performance.now(), k = act < 0 ? REST : act;
    strips.forEach((st, i) => {
      const d = i - k, wait = Math.abs(i - from) * STEP;
      const part = act < 0 || d === 0 ? 0 : Math.sign(d) * rad(PART) * Math.max(0, 1 - (Math.abs(d) - 1) * 0.22);
      tset(st.a, restA(i) + part, now, wait);
      tset(st.s, d === 0 ? (act < 0 ? OUT * 0.55 : OUT) : 0, now, wait);
      tset(st.z, d === 0 ? N * DZ + LIFT : i * DZ, now, 0);
      st.el.sil.classList.toggle("hi", d === 0);
    });
    read.textContent = act < 0 ? "rest" : `swatch ${String(act + 1).padStart(2, "0")}`;
    B.wake();
  }
  function setActive(a) { if (a === act) return; const from = a >= 0 ? a : act; act = a; apply(from); }

  apply(REST);
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { PART = v; apply(act < 0 ? REST : act); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "swatch-fan",
  means: "A fan deck of colour strips: the one under the pointer slides out of the deck, and the rest part around it.",
  rules: [1, 2, 5, 9],
  range: [4, 8, 13],
  mount,
});
