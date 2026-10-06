/**
 * rolodex: a rotary card file, twenty-six tabbed cards round a hub between two
 * wheels, on a stand. The cards bunch on either side of the one standing open
 * at the top. Moving the pointer up or down over it pushes the drum round;
 * friction bleeds the spin, then a detent catches the nearest card and stands
 * it up, bright. A click turns one card on. Each card's tab sits one step
 * along from the last. The slider is the coast, in seconds.
 */
const {
  Cam, circ, clamp, fillet, fit, hull, open, poly, proj, rings, prism, facing, run, seg,
  spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const N = 26, CW = 56, CH = 30, RH = 7, TK = 0.9, Z0 = 47, GAP = 0.42, TW = 9, TH = 4.2;
const STEP = (2 * Math.PI - 2 * GAP) / N, GAIN = 0.3, C0 = 0;

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

/** Where card k stands when the drum is turned to c: the open card upright, the rest bunched away from it on both sides. */
function angle(k, c) {
  const d = ((((k - c) % N) + N + N / 2) % N) - N / 2;
  return d * STEP + GAP * Math.tanh(1.6 * d);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let coast = value, w = 0, last = null, over = false, shown = -1;
  const sp = spring(C0, { eps: 0.002 });

  const C = Cam(45, 0.5, 1.98);
  const R = RH + CH + TH;
  fit(C, [[-12, -30, 0], [CW + 12, 30, 0], [CW + 12, -30, 0], [-12, 30, 0], [-12, 0, Z0 + R], [CW + 12, 0, Z0 + R], [CW, R, Z0], [0, -R, Z0]], 200, 164);
  const P = proj(C), V = viewDir(P), front = facing(C);
  const shaft = (parent, x0, r, T) => { const q = slab(P, V, (u, v, t) => [x0 + t, u, Z0 + v], circ(r, 28), circ(r - 1, 28), T); const el = solid(parent); el.sil.setAttribute("d", q.sil); el.cr.setAttribute("d", q.crease); return el; };
  const leg = fillet([[-17, 5], [17, 5], [6, Z0 + 6], [-6, Z0 + 6]], [3, 3, 6, 6]);
  const arm = (parent, x0) => {
    const el = solid(parent), f = (x) => leg.map(([u, v]) => P(x, u, v));
    el.sil.setAttribute("d", poly(hull(f(x0).concat(f(x0 + 4)))));
    el.cr.setAttribute("d", poly(fillet([[-11, 9], [11, 9], [3, Z0 - 8], [-3, Z0 - 8]], [2, 2, 3, 3]).map(([u, v]) => P(x0 + 4, u, v))));
  };

  const g = mk("g", {}, svg);
  const [br, bi] = rings(-14, -30, CW + 14, 30, 8, 2);
  put(solid(g), prism(P, front, br, bi, 0, 6));
  arm(g, -12); shaft(g, -8, 13, 3);

  const cards = [];
  for (let k = 0; k < N; k++) {
    const t0 = 4 + (k % 5) * 10.4;
    const shape = fillet([[0, 0], [CW, 0], [CW, CH], [t0 + TW, CH], [t0 + TW, CH + TH], [t0, CH + TH], [t0, CH], [0, CH]], [1, 1, 2.6, 1.4, 2, 2, 1.4, 2.6]);
    const grp = mk("g", {}, g);
    cards.push({ k, shape, grp, back: mk("path", { class: "lo" }, grp), face: mk("path", { class: "sil" }, grp), lines: mk("path", { class: "nf lo" }, grp) });
  }
  const hub = shaft(g, -5, RH, CW + 10);
  const near = mk("g", {}, g);
  shaft(near, CW + 5, 13, 3); arm(near, CW + 8);

  let drawn = NaN, order = "";
  function draw() {
    const c = sp.x;
    if (c === drawn) return;
    drawn = c;
    const depth = [];
    for (const cd of cards) {
      const th = angle(cd.k, c), s = Math.sin(th), co = Math.cos(th);
      const at = (u, v, t) => [u, (RH + v) * s + t * co, Z0 + (RH + v) * co - t * s];
      const tn = co * V[1] - s * V[2] > 0 ? TK : 0, tf = TK - tn;
      cd.back.setAttribute("d", poly(cd.shape.map(([u, v]) => P(...at(u, v, tf)))));
      cd.face.setAttribute("d", poly(cd.shape.map(([u, v]) => P(...at(u, v, tn)))));
      const d = Math.abs(((((cd.k - c) % N) + N + N / 2) % N) - N / 2);
      cd.lines.setAttribute("d", d < 1.5 ? [CH - 8, CH - 14, CH - 20].map((v) => seg(P(...at(5, v, tn)), P(...at(CW - 5, v, tn)))).join("") : "");
      depth.push([s * V[1] + co * V[2], cd]);
    }
    depth.push([0, { grp: hub.g, k: "h" }]);
    depth.sort((a, b) => a[0] - b[0]);
    const key = depth.map((d) => d[1].k).join();
    if (key !== order) { order = key; depth.forEach((d) => near.before(d[1].grp)); }
    const top = ((Math.round(c) % N) + N) % N;
    if (top !== shown) { shown = top; cards.forEach((cd) => cd.face.classList.toggle("hi", cd.k === top)); }
  }

  const B = register(stage, (dt) => {
    let m = false;
    if (Math.abs(w) > 0.8) {
      sp.x += w * dt; w *= Math.exp(-dt / coast); m = true;
    } else {
      w = 0; sp.t = Math.round(sp.x); m = stepS(sp, dt);
    }
    draw();
    if (over) read.textContent = name();
    return m;
  });
  bag.add(B.unregister);
  const name = () => `card ${String.fromCharCode(65 + (((Math.round(sp.x) % N) + N) % N))}`;

  bag.add(pointer(stage, {
    move: (p) => {
      if (last) w = clamp(w - (p[1] - last[1]) * GAIN, -28, 28);
      last = p; over = true; read.textContent = name(); B.wake();
    },
    down: () => { w = 0; sp.t = Math.round(sp.x) - 1; B.wake(); },
    leave: () => { last = null; over = false; read.textContent = "rest"; B.wake(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { coast = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "rolodex",
  means: "A rotary card file: push it round with the pointer, it coasts, and a detent stands the nearest card up.",
  rules: [1, 7, 8, 9],
  range: [0.25, 0.6, 1.2],
  mount,
});
