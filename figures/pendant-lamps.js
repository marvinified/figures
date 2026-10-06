/**
 * pendant-lamps: five pendant lamps on cords of different lengths from one
 * ceiling rail, over a dining table: a dome, a cone, a globe, a drum and a
 * bell. The pointer passing a shade pushes it away, each lamp swinging back on
 * its own springs, by as much as the slider says; the lamp nearest the pointer
 * is lit, its pool of light dashed on the table under it and following its
 * swing. At rest the middle lamp is lit and all hang still.
 */
const {
  Cam, clamp, fit, hull, poly, open, proj, prism, rings, seg, facing, unproj,
  spring, stepS, mk, pointer, put, register, disposer, solid, flatDot, place,
} = HL;

const ZR = 124, ZT = 33, TABLE = [-8, -26, 140, 26], REACH = 26, REST = 2;
/** Shade profiles, radius by height from the rim (h = 0) to the top (h = H). */
const SHADES = [
  { H: 9, r: (h) => 1.4 + 9.6 * Math.sqrt(Math.max(0, 1 - (h / 9) ** 2)) },
  { H: 13, r: (h) => 10 - (8.6 * h) / 13 },
  { H: 15, r: (h) => Math.max(1.2, 7.5 * Math.sin((Math.PI * Math.min(h, 14.5)) / 15)) },
  { H: 10, r: (h) => (h < 9.9 ? 8.2 : 1.4) },
  { H: 13, r: (h) => 1.5 + 9.5 * (1 - h / 13) ** 1.7 },
];
const LAMPS = [[10, 44], [37, 56], [64, 38], [91, 60], [118, 46]].map(([x, cord], i) => ({ i, x, top: ZR - cord, s: SHADES[i] }));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let PUSH = value, over = null, lit = -1;

  const C = Cam(45, 0.5, 1.72);
  fit(C, [[TABLE[0], TABLE[1], 0], [TABLE[2], TABLE[3], 0], [TABLE[0], TABLE[3], 0], [TABLE[2], TABLE[1], 0], [-6, 0, ZR + 4], [134, 0, ZR + 4]], 200, 164);
  const P = proj(C), front = facing(C);
  const zf = Math.sqrt(1 - C.k * C.k), V = [Math.sin(C.az) * C.k, Math.cos(C.az) * C.k, zf];
  const block = (x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, ring, inner, z0, z1)); };

  const g = mk("g", {}, svg);
  for (const [x, y] of [[TABLE[0] + 6, TABLE[1] + 6], [TABLE[2] - 6, TABLE[1] + 6], [TABLE[0] + 6, TABLE[3] - 6], [TABLE[2] - 6, TABLE[3] - 6]]) block(x - 2, y - 2, x + 2, y + 2, 1, 0.5, 0, ZT - 3);
  block(TABLE[0], TABLE[1], TABLE[2], TABLE[3], 3, 1.2, ZT - 3, ZT);
  const pool = flatDot(g, C, 13, "dash");
  block(-6, -2.5, 134, 2.5, 1.2, 0.6, ZR, ZR + 4);

  // under-damped on purpose: a hung shade swings past its rest and settles
  const lamps = LAMPS.map((l) => {
    const lg = mk("g", {}, g);
    return { ...l, lg, cord: mk("path", { class: "nf" }, lg), el: solid(lg), ox: spring(0, { k: 60, c: 7, eps: 0.02 }), oy: spring(0, { k: 60, c: 7, eps: 0.02 }), drawn: "" };
  });

  /** A shade hung from its rail point down its cord: rings across the cord's line, their hull for the outline, a band's front half for the crease. */
  function drawLamp(l) {
    const key = l.ox.x.toFixed(2) + "," + l.oy.x.toFixed(2);
    if (key === l.drawn) return;
    l.drawn = key;
    const A = [l.x, 0, ZR], T = [l.x + l.ox.x, l.oy.x, l.top], d = [A[0] - T[0], A[1] - T[1], A[2] - T[2]], m = Math.hypot(...d), a = d.map((c) => c / m);
    let e1 = [a[2], 0, -a[0]];
    const n1 = Math.hypot(...e1); e1 = e1.map((c) => c / n1);
    const e2 = [a[1] * e1[2] - a[2] * e1[1], a[2] * e1[0] - a[0] * e1[2], a[0] * e1[1] - a[1] * e1[0]];
    const pt = (h, r, f) => { const c = Math.cos(f) * r, s = Math.sin(f) * r, k = h - l.s.H; return P(T[0] + a[0] * k + e1[0] * c + e2[0] * s, T[1] + a[1] * k + e1[1] * c + e2[1] * s, T[2] + a[2] * k + e1[2] * c + e2[2] * s); };
    const pts = [];
    for (let j = 0; j <= 14; j++) { const h = (l.s.H * j) / 14; for (let k = 0; k < 32; k++) pts.push(pt(h, l.s.r(h), (k / 32) * Math.PI * 2)); }
    const ff = Math.atan2(e2[0] * V[0] + e2[1] * V[1] + e2[2] * V[2], e1[0] * V[0] + e1[1] * V[1] + e1[2] * V[2]), hb = l.s.H * 0.62;
    l.el.sil.setAttribute("d", poly(hull(pts)));
    l.el.cr.setAttribute("d", open(Array.from({ length: 17 }, (_, k) => pt(hb, l.s.r(hb), ff - Math.PI / 2 + (k / 16) * Math.PI))));
    l.cord.setAttribute("d", seg(P(...A), P(...T)));
    l.foot = [T[0] - a[0] * l.s.H * 0.3, T[1] - a[1] * l.s.H * 0.3];
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const l of lamps) { if (stepS(l.ox, dt) | stepS(l.oy, dt)) m = true; drawLamp(l); }
    lamps.slice().sort((a, b) => a.x + a.ox.x + a.oy.x - (b.x + b.ox.x + b.oy.x)).forEach((l) => g.appendChild(l.lg));
    const l = lamps[lit < 0 ? REST : lit];
    place(pool, P(clamp(l.foot[0], TABLE[0] + 14, TABLE[2] - 14), clamp(l.foot[1], TABLE[1] + 8, TABLE[3] - 8), ZT));
    return m;
  });
  bag.add(B.unregister);

  /** The lamp whose resting shade is nearest the pointer on screen. */
  function nearest([sx, sy]) {
    let best = -1, bd = 1e9;
    lamps.forEach((l) => { const c = P(l.x, 0, l.top - l.s.H / 2), d = Math.hypot(sx - c[0], sy - c[1]); if (d < bd) { bd = d; best = l.i; } });
    return bd < 60 ? best : -1;
  }

  /** Each shade pushed away from the pointer, read on the level of that shade: none under it or past the reach, most a third of the way out. */
  function retarget() {
    for (const l of lamps) {
      let tx = 0, ty = 0;
      if (over) {
        const [x, y] = unproj(C, over[0], over[1], l.top - l.s.H / 2), dx = l.x - x, dy = -y, d = Math.hypot(dx, dy);
        if (d < REACH && d > 1e-3) { const u = d / REACH, f = PUSH * 6.75 * u * (1 - u) ** 2; tx = (dx / d) * f; ty = (dy / d) * f; }
      }
      l.ox.t = tx; l.oy.t = ty;
    }
    const k = over ? nearest(over) : -1;
    if (k !== lit) { lit = k; lamps.forEach((l) => l.el.sil.classList.toggle("hi", l.i === (k < 0 ? REST : k))); }
    read.textContent = k < 0 ? "rest" : `lamp ${k + 1}`;
    B.wake();
  }

  lamps.forEach((l) => l.el.sil.classList.toggle("hi", l.i === REST));
  retarget();
  bag.add(pointer(stage, { move: (p) => { over = p; retarget(); }, leave: () => { over = null; retarget(); } }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { PUSH = v; retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "pendant-lamps",
  means: "Pendant lamps over a table: the pointer pushes the shades it passes and they swing back; the nearest one is lit.",
  rules: [1, 3, 8],
  range: [6, 12, 18],
  mount,
});
