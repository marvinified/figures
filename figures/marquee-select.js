/**
 * marquee-select: a design canvas with nine shapes on it, boxes, discs and
 * pills, and a cursor. A dashed marquee runs from the canvas's far corner to
 * the pointer; every shape wholly inside it is selected and lifts off the
 * canvas, nearest the corner first by the slider's step, and a selection box
 * with four handles closes round them. The cursor takes the bright edge. At
 * rest the marquee holds the first two shapes.
 */
const {
  Cam, clamp, fit, poly, proj, prism, rings, rrect, circ, facing, unproj,
  spring, stepS, tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const BW = 124, BH = 88, A = [4, 4], T = 2, LIFT = 7, REST = [62, 32];
const disc = (cx, cy, r) => ({ box: [cx - r, cy - r, cx + r, cy + r], ring: () => circ(r, 40).map((q) => ({ ...q, u: q.u + cx, v: q.v + cy })), inner: () => circ(r - 1, 40).map((q) => ({ ...q, u: q.u + cx, v: q.v + cy })) });
const box = (x0, y0, x1, y1, r) => ({ box: [x0, y0, x1, y1], ring: () => rings(x0, y0, x1, y1, r, 0.8)[0], inner: () => rings(x0, y0, x1, y1, r, 0.8)[1] });
const SHAPES = [box(12, 10, 36, 26, 2), disc(52, 19, 9), box(70, 13, 110, 23, 5), box(12, 36, 30, 58, 2), disc(52, 48, 11), box(70, 38, 90, 56, 3), box(98, 34, 112, 72, 7), box(12, 66, 60, 78, 2), disc(82, 70, 7)];
const CURSOR = [[0, 0], [0, 15], [3.8, 11.4], [6.6, 17.2], [9, 16.2], [6.2, 10.4], [11, 10.4]];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let STEP = value, over = null, picked = "";

  const C = Cam(45, 0.5, 2.05);
  fit(C, [[-3, -3, -3], [BW + 3, -3, -3], [BW + 3, BH + 3, -3], [-3, BH + 3, -3], [0, 0, LIFT + T + 2], [BW, 0, LIFT + T + 2]], 200, 164);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  { const [ring, inner] = rings(-3, -3, BW + 3, BH + 3, 4, 1.4); put(solid(g), prism(P, front, ring, inner, -3, 0)); }
  const marquee = mk("path", { class: "nf dash" }, g);
  const shapes = SHAPES.map((s, i) => ({ i, ...s, rg: s.ring(), ig: s.inner(), z: tween(0), drawn: NaN, d: Math.hypot(s.box[0] - A[0], s.box[1] - A[1]) }))
    .sort((a, b) => a.box[0] + a.box[1] - (b.box[0] + b.box[1]));
  for (const s of shapes) s.el = solid(g);
  const frame = mk("path", { class: "nf" }, g), handles = mk("path", { class: "sil" }, g), cursor = mk("path", { class: "sil hi" }, g);
  const qx = spring(REST[0], { eps: 0.05 }), qy = spring(REST[1], { eps: 0.05 });

  const inside = (s, q) => s.box[0] >= A[0] && s.box[1] >= A[1] && s.box[2] <= q[0] && s.box[3] <= q[1];

  function draw(now) {
    const q = [qx.x, qy.x];
    marquee.setAttribute("d", poly([[A[0], A[1]], [q[0], A[1]], q, [A[0], q[1]]].map(([x, y]) => P(x, y, 0.2))));
    const tip = P(q[0], q[1], 0.2), k = C.S * 0.42;
    cursor.setAttribute("d", poly(CURSOR.map(([u, v]) => [tip[0] + u * k, tip[1] + v * k])));
    const sel = [];
    for (const s of shapes) {
      const z = tval(s.z, now);
      if (z > 0.5) sel.push(s);
      if (z === s.drawn) continue;
      s.drawn = z;
      put(s.el, prism(P, front, s.rg, s.ig, z, z + T));
    }
    if (!sel.length) { frame.setAttribute("d", ""); handles.setAttribute("d", ""); return; }
    const x0 = Math.min(...sel.map((s) => s.box[0])) - 2, y0 = Math.min(...sel.map((s) => s.box[1])) - 2, x1 = Math.max(...sel.map((s) => s.box[2])) + 2, y1 = Math.max(...sel.map((s) => s.box[3])) + 2;
    const zt = Math.max(...sel.map((s) => tval(s.z, now))) + T;
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    frame.setAttribute("d", poly(corners.map(([x, y]) => P(x, y, zt))));
    handles.setAttribute("d", corners.map(([x, y]) => poly(rrect(x - 1.8, y - 1.8, x + 1.8, y + 1.8, 0.4, 1).map((h) => P(h.u, h.v, zt)))).join(""));
  }

  const B = register(stage, (dt, now) => {
    let m = stepS(qx, dt) | stepS(qy, dt);
    draw(now);
    for (const s of shapes) if (!tdone(s.z, now)) m = true;
    return !!m;
  });
  bag.add(B.unregister);

  function retarget() {
    const q = over || REST;
    qx.t = q[0]; qy.t = q[1];
    const sel = shapes.filter((s) => inside(s, q)), key = sel.map((s) => s.i).join();
    if (key !== picked) {
      picked = key;
      const now = performance.now(), order = sel.slice().sort((a, b) => a.d - b.d);
      for (const s of shapes) { const r = order.indexOf(s); tset(s.z, r >= 0 ? LIFT : 0, now, r >= 0 ? r * STEP : 0); }
    }
    read.textContent = over ? `${sel.length} selected` : "rest";
    B.wake();
  }

  retarget();
  for (const s of shapes) { s.z.from = s.z.to; s.z.t0 = -1e9; }
  bag.add(pointer(stage, {
    move: ([sx, sy]) => { const [x, y] = unproj(C, sx, sy, 0); over = x > -30 && x < BW + 30 && y > -30 && y < BH + 30 ? [clamp(x, A[0] + 2, BW), clamp(y, A[1] + 2, BH)] : null; retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { STEP = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "marquee-select",
  means: "Marquee selection on a design canvas: the shapes wholly inside the dashed box lift and are framed with handles.",
  rules: [3, 5, 9],
  range: [0, 40, 90],
  mount,
});
