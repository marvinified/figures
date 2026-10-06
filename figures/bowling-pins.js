/**
 * bowling-pins: a lane's end with ten pins racked in a triangle, each pin turned
 * with a waist and a neck and two stripes, and a ball with its finger holes.
 * The ball follows the pointer along the lane on two springs, into the rack if
 * you take it there; each pin leans away from it on its own springs, the
 * nearest most, as far as the slider's reach, and a pin the ball reaches is
 * shoved aside. The pin nearest the ball takes the bright edge. At rest the ball sits back on the lane and the head pin barely leans.
 */
const {
  Cam, clamp, fit, open, poly, proj, prism, rings, seg, facing, rad, unproj,
  spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const D = 12, R = 8.6, CLEAR = R + 4.5, GAP = 10, MAX = rad(28), XB = -44 + R + 2, XL = [-44, 74], YL = 24, BREST = [56, 5];
const PROF = [[0, 2.3], [2.5, 3.5], [8.5, 4.7], [14, 3.9], [19, 2], [21, 1.9], [24.5, 2.6], [27.5, 2.3], [29.4, 1.1], [30, 0]];
const STRIPES = [19.6, 21.2];

/** The pin's radius h up its axis, eased between the profile's points. */
function radius(h) {
  for (let i = 1; i < PROF.length; i++) if (h <= PROF[i][0]) {
    const [h0, r0] = PROF[i - 1], [h1, r1] = PROF[i], t = (h - h0) / (h1 - h0);
    return r0 + (r1 - r0) * (0.5 - 0.5 * Math.cos(Math.PI * t));
  }
  return 0;
}
const HS = Array.from({ length: 31 }, (_, i) => i);

/** The ten pins: the head pin nearest the ball, the rows behind it, numbered the way the game does. */
const PINS = [];
for (let r = 0; r < 4; r++) for (let j = 0; j <= r; j++) PINS.push({ no: PINS.length + 1, x: -r * D * 0.866, y: (j - r / 2) * D });

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let REACH = value, over = null, lit = -1;

  const C = Cam(45, 0.5, 2.05);
  fit(C, [[XL[0], -YL, 0], [XL[0], YL, 34], [XL[1], -YL, 0], [XL[1], YL, -3], [XL[0], -YL, 34]], 200, 168);
  const P = proj(C), front = facing(C), O = P(0, 0, 0);
  const L = (v) => { const q = P(v[0], v[1], v[2]); return [q[0] - O[0], q[1] - O[1]]; };
  const zf = Math.sqrt(1 - C.k * C.k), V = [Math.sin(C.az) * C.k, Math.cos(C.az) * C.k, zf];

  const g = mk("g", {}, svg);
  { const [ring, inner] = rings(XL[0], -YL, XL[1], YL, 2, 1); put(solid(g), prism(P, front, ring, inner, -3, 0)); }
  mk("path", { d: [-YL + 5, -YL / 3, YL / 3, YL - 5].map((y) => seg(P(XL[0] + 4, y, 0), P(XL[1] - 2, y, 0))).join("") + seg(P(XL[1] - 12, -YL, 0), P(XL[1] - 12, YL, 0)), class: "nf lo" }, g);

  const pins = PINS.map((p) => {
    const el = solid(g);
    return { ...p, el, marks: mk("path", { class: "nf lo" }, el.g), tx: spring(0, { eps: 0.002 }), ty: spring(0, { eps: 0.002 }), ox: spring(0, { eps: 0.05 }), oy: spring(0, { eps: 0.05 }), side: [1, 0], drawn: "" };
  });
  const ball = { el: solid(g), x: spring(BREST[0], { eps: 0.05 }), y: spring(BREST[1], { eps: 0.05 }), drawn: "" };
  ball.holes = mk("path", { class: "nf lo" }, ball.el.g);

  /** A pin turned about axis a from its base: the outline traced along both sides of the screen axis, closed by the foot's near arc, and the stripes' front halves. */
  function lathe(b, a) {
    const t = Math.abs(a[2]) < 0.99 ? [0, 0, 1] : [1, 0, 0];
    let e1 = [a[1] * t[2] - a[2] * t[1], a[2] * t[0] - a[0] * t[2], a[0] * t[1] - a[1] * t[0]];
    const m = Math.hypot(...e1); e1 = e1.map((c) => c / m);
    const e2 = [a[1] * e1[2] - a[2] * e1[1], a[2] * e1[0] - a[0] * e1[2], a[0] * e1[1] - a[1] * e1[0]];
    const p1 = L(e1), p2 = L(e2), pa = L(a), la = Math.hypot(...pa), n = [-pa[1] / la, pa[0] / la];
    const fs = Math.atan2(n[0] * p2[0] + n[1] * p2[1], n[0] * p1[0] + n[1] * p1[1]);
    const at = (h, r, f) => { const c = P(b[0] + a[0] * h, b[1] + a[1] * h, b[2] + a[2] * h); return [c[0] + r * (Math.cos(f) * p1[0] + Math.sin(f) * p2[0]), c[1] + r * (Math.cos(f) * p1[1] + Math.sin(f) * p2[1])]; };
    const right = HS.map((h) => at(h, radius(h), fs)), left = HS.map((h) => at(h, radius(h), fs + Math.PI)).reverse();
    const b0 = P(...b), mid = at(0, PROF[0][1], fs + Math.PI / 2), sgn = (mid[0] - b0[0]) * pa[0] + (mid[1] - b0[1]) * pa[1] < 0 ? -1 : 1;
    const foot = Array.from({ length: 13 }, (_, k) => at(0, PROF[0][1], fs + Math.PI + sgn * (k / 12) * Math.PI));
    const ff = Math.atan2(e2[0] * V[0] + e2[1] * V[1] + e2[2] * V[2], e1[0] * V[0] + e1[1] * V[1] + e1[2] * V[2]);
    const stripes = STRIPES.map((h) => open(Array.from({ length: 13 }, (_, k) => at(h, radius(h), ff - Math.PI / 2 + (k / 12) * Math.PI)))).join("");
    return { sil: poly(right.concat(left, foot)), marks: stripes };
  }

  function drawPin(p) {
    const tx = p.tx.x, ty = p.ty.x, th = Math.hypot(tx, ty), key = [tx, ty, p.ox.x, p.oy.x].map((v) => v.toFixed(3)).join();
    if (key === p.drawn) return;
    p.drawn = key;
    const s = th > 1e-6 ? Math.sin(th) / th : 1, a = [tx * s, ty * s, Math.cos(th)];
    const q = lathe([p.x + p.ox.x, p.y + p.oy.x, 0], a);
    p.el.sil.setAttribute("d", q.sil);
    p.marks.setAttribute("d", q.marks);
  }
  function drawBall() {
    const key = ball.x.x.toFixed(2) + "," + ball.y.x.toFixed(2);
    if (key === ball.drawn) return;
    ball.drawn = key;
    const [cx, cy] = P(ball.x.x, ball.y.x, R), r = R * C.S;
    ball.el.sil.setAttribute("d", `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`);
    ball.holes.setAttribute("d", [[-0.28, -0.42, 0.11], [0.02, -0.5, 0.11], [-0.1, -0.12, 0.14]].map(([u, v, h]) => {
      const x = cx + u * r, y = cy + v * r, w = h * r, hh = w * 0.62;
      return `M${x - w} ${y}a${w} ${hh} 0 1 0 ${2 * w} 0a${w} ${hh} 0 1 0 ${-2 * w} 0Z`;
    }).join(""));
  }

  /** Each pin's lean away from the ball, full within a pin's width of it and none past the reach, and its foot shoved clear of the ball and of the others. A shoved pin keeps the side of the ball it was met on and slides round it. A lean toward the camera is mostly turned sideways: end on, a turned outline folds over itself. */
  function retarget() {
    const bx = ball.x.x, by = ball.y.x;
    let near = 0, best = 1e9;
    const at = pins.map((p) => {
      const vx = p.x - bx, vy = p.y - by, d = Math.hypot(vx, vy);
      if (d >= CLEAR) { p.side = [vx / d, vy / d]; return [p.x, p.y]; }
      const sx = vx + 0.6 * CLEAR * p.side[0], sy = vy + 0.6 * CLEAR * p.side[1], m = Math.hypot(sx, sy) || 1;
      p.side = [sx / m, sy / m];
      return [bx + p.side[0] * CLEAR, by + p.side[1] * CLEAR];
    });
    for (let it = 0; it < 4; it++) for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
      const dx = at[j][0] - at[i][0], dy = at[j][1] - at[i][1], d = Math.hypot(dx, dy) || 1, o = (GAP - d) / 2;
      if (o > 0) { at[i] = [at[i][0] - (dx / d) * o, at[i][1] - (dy / d) * o]; at[j] = [at[j][0] + (dx / d) * o, at[j][1] + (dy / d) * o]; }
    }
    pins.forEach((p, i) => {
      const dx = at[i][0] - bx, dy = at[i][1] - by, d = Math.hypot(dx, dy) || 1, u = clamp((d - CLEAR) / REACH, 0, 1), f = (1 - u) ** 2 * MAX;
      let lx = (dx / d) * f, ly = (dy / d) * f;
      const tw = (lx + ly) / 2;
      if (tw > 0) { lx -= 0.75 * tw; ly -= 0.75 * tw; }
      p.tx.t = lx; p.ty.t = ly; p.ox.t = at[i][0] - p.x; p.oy.t = at[i][1] - p.y;
      if (d < best) { best = d; near = p.no; }
    });
    if (near !== lit) { lit = near; pins.forEach((p) => p.el.sil.classList.toggle("hi", p.no === near)); }
    const txt = over ? `pin ${near}` : "rest";
    if (read.textContent !== txt) read.textContent = txt;
  }

  const B = register(stage, (dt) => {
    let m = stepS(ball.x, dt) | stepS(ball.y, dt);
    retarget();
    for (const p of pins) if (stepS(p.tx, dt) | stepS(p.ty, dt) | stepS(p.ox, dt) | stepS(p.oy, dt)) m = true;
    const order = pins.map((p) => ({ k: p.x + p.ox.x + p.y + p.oy.x, g: p.el.g })).concat([{ k: ball.x.x + ball.y.x, g: ball.el.g }]).sort((a, b) => a.k - b.k);
    for (const o of order) g.appendChild(o.g);
    pins.forEach(drawPin); drawBall();
    return !!m;
  });
  bag.add(B.unregister);

  function aim() {
    const [x, y] = over || BREST;
    ball.x.t = clamp(x, XB, XL[1] - R - 2); ball.y.t = clamp(y, -YL + R + 1, YL - R - 1);
    retarget();
    B.wake();
  }

  aim();
  bag.add(pointer(stage, {
    move: ([sx, sy]) => { const w = unproj(C, sx, sy, R); over = w[0] > XL[0] - 10 && w[0] < XL[1] + 20 && Math.abs(w[1]) < YL + 16 ? w : null; aim(); },
    leave: () => { over = null; aim(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { REACH = v; retarget(); B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "bowling-pins",
  means: "Ten pins and a ball: the ball follows the pointer down the lane and the pins nearest it lean away.",
  rules: [3, 8, 9],
  range: [16, 26, 38],
  mount,
});
