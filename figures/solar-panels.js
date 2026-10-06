/**
 * solar-panels: twelve panels on posts over a gravel pad, each a framed plate
 * ruled into cells. The pointer is the sun: put back on the plane of the
 * pivots, it stands a fixed height above that point, and every panel tilts to
 * face it on its own springs, the one under it lying flat and the far ones
 * tipped toward it, as far as the slider lets them. At rest the sun is low in
 * the near corner and the panel nearest it is bright. The slider is the tilt.
 */
const {
  Cam, clamp, fit, hull, open, poly, prism, proj, rings, rrect, run, seg, unproj, facing,
  spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const NX = 4, NY = 3, PX = 40, PY = 30, W = 30, D = 18, T = 1.6, HP = 17, HS = 46;
const X1 = NX * PX, Y1 = NY * PY, SUN0 = [X1 + 4, Y1 + 22];

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

/** A panel's frame, from the slope (gx, gy) its normal leans by: across, up-slope, and the normal. */
function frame(gx, gy) {
  const nl = Math.hypot(gx, gy, 1), n = [gx / nl, gy / nl, 1 / nl];
  const al = Math.hypot(1, gx), a = [1 / al, 0, -gx / al];
  const b = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
  return { a, b, n };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let maxG = Math.tan((value * Math.PI) / 180), sun = SUN0, pick = -1;

  const C = Cam(45, 0.5, 1.72);
  fit(C, [[-10, -10, -4], [X1 + 10, Y1 + 10, -4], [X1 + 10, -10, -4], [-10, Y1 + 10, -4], [PX / 2, PY / 2, HP + 16], [X1 - PX / 2, PY / 2, HP + 16]], 200, 172);
  const P = proj(C), V = viewDir(P), front = facing(C);
  const ring = rrect(-W / 2, -D / 2, W / 2, D / 2, 2.2, 4), inner = rrect(-W / 2 + 1.2, -D / 2 + 1.2, W / 2 - 1.2, D / 2 - 1.2, 1.2, 4);

  const g = mk("g", {}, svg);
  const [pr, pi] = rings(-10, -10, X1 + 10, Y1 + 10, 10, 2.2);
  put(solid(g), prism(P, front, pr, pi, -4, 0));

  const panels = [];
  for (let s = 0; s <= NX + NY - 2; s++) for (let i = 0; i < NX; i++) {
    const j = s - i;
    if (j < 0 || j >= NY) continue;
    const cx = (i + 0.5) * PX, cy = (j + 0.5) * PY, grp = mk("g", {}, g);
    const [qr, qi] = rings(cx - 1.7, cy - 1.7, cx + 1.7, cy + 1.7, 1.7, 0.6);
    put(solid(grp), prism(P, front, qr, qi, 0, HP - 0.5));
    const el = solid(grp), cells = mk("path", { class: "nf lo" }, el.g);
    panels.push({ i, j, cx, cy, el, cells, gx: spring(0, { eps: 0.002 }), gy: spring(0, { eps: 0.002 }), drawn: "" });
  }

  function draw(p) {
    const key = p.gx.x.toFixed(4) + "," + p.gy.x.toFixed(4);
    if (key === p.drawn) return;
    p.drawn = key;
    const { a, b, n } = frame(p.gx.x, p.gy.x);
    const at = (u, v, t) => [p.cx + u * a[0] + v * b[0] + t * n[0], p.cy + u * a[1] + v * b[1] + t * n[1], HP + u * a[2] + v * b[2] + t * n[2]];
    const q = slab(P, V, at, ring, inner, T);
    p.el.sil.setAttribute("d", q.sil);
    p.el.cr.setAttribute("d", q.crease);
    const on = (u, v) => P(...at(u, v, T));
    const lines = [-W / 4, 0, W / 4].map((u) => seg(on(u, -D / 2 + 1.6), on(u, D / 2 - 1.6))).join("") + seg(on(-W / 2 + 1.6, 0), on(W / 2 - 1.6, 0));
    p.cells.setAttribute("d", q.tn === T ? lines : "");
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const p of panels) { if (stepS(p.gx, dt)) m = true; if (stepS(p.gy, dt)) m = true; draw(p); }
    return m;
  });
  bag.add(B.unregister);

  /** Every panel's slope toward the sun, clamped to the slider's tilt; the bright one is the panel nearest under it. */
  function aim() {
    let best = null, bd = Infinity;
    for (const p of panels) {
      let gx = (sun[0] - p.cx) / HS, gy = (sun[1] - p.cy) / HS;
      const m = Math.hypot(gx, gy);
      if (m > maxG) { gx *= maxG / m; gy *= maxG / m; }
      p.gx.t = gx; p.gy.t = gy;
      const d = Math.hypot(sun[0] - p.cx, sun[1] - p.cy);
      if (d < bd) { bd = d; best = p; }
    }
    const k = panels.indexOf(best);
    if (k !== pick) { pick = k; panels.forEach((p) => p.el.sil.classList.toggle("hi", p === best)); }
    B.wake();
    return best;
  }

  aim();
  bag.add(pointer(stage, {
    move: ([sx, sy]) => {
      const [x, y] = unproj(C, sx, sy, HP);
      sun = [clamp(x, -PX, X1 + PX), clamp(y, -PY, Y1 + PY)];
      const p = aim();
      read.textContent = `panel ${p.i + 1}·${p.j + 1}`;
    },
    leave: () => { sun = SUN0; aim(); read.textContent = "rest"; },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { maxG = Math.tan((v * Math.PI) / 180); aim(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "solar-panels",
  means: "Solar panels on posts: wherever the pointer is, the sun is, and every panel tilts to face it.",
  rules: [1, 3, 5, 9],
  range: [25, 45, 65],
  mount,
});
