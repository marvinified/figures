/**
 * device-frames: four device frames standing in the grooves of one stand, back
 * to front a browser window, a tablet, a phone and a watch, each with what
 * gives it away: a tab bar and three dots, a camera, a notch and a home bar,
 * a strap. They lean back at rest, the phone bright. The pointer
 * picks a frame by its resting outline; it stands up and lifts, the ones in
 * front lean forward and the ones behind lean back, staggered outwards from
 * it on the 700ms lift curve. The slider is the stagger, in ms.
 */
const {
  Cam, fillet, fit, facing, poly, prism, proj, rad, rings, seg,
  tween, tset, tval, tdone, disposer, mk, place, pointer, put, register, solid,
} = HL;

const CX = 40, G = 17, BZ = 6, TK = 1.4, REST = -10, BACK = -22, FWD = 16, LIFT = 12;
const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
const DEV = [
  { name: "browser", w: 74, h: 48, r: 3, shape: rect(0, 0, 74, 48), screen: [3, 3, 71, 38], bar: 40, dots: [[6, 44], [10, 44], [14, 44]] },
  { name: "tablet", w: 42, h: 56, r: 4.5, shape: rect(0, 0, 42, 56), screen: [3.5, 5, 38.5, 51], dots: [[21, 53.5]] },
  { name: "phone", w: 25, h: 48, r: 4.5, shape: rect(0, 0, 25, 48), screen: [2, 2, 23, 46], notch: [9, 16, 44], home: [8.5, 16.5, 4.5] },
  {
    name: "watch", w: 18, h: 38, r: 2.2, screen: [2.5, 11, 15.5, 27],
    shape: [[4.5, 0], [13.5, 0], [13.5, 8], [18, 8], [18, 30], [13.5, 30], [13.5, 38], [4.5, 38], [4.5, 30], [0, 30], [0, 8], [4.5, 8]],
  },
];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value, act = -1;

  const C = Cam(45, 0.5, 2.2);
  const N = DEV.length, Y1 = (N - 1) * G;
  fit(C, [[-4, -8, 0], [84, Y1 + 10, 0], [84, -8, 0], [-4, Y1 + 10, 0], [0, -8, 60 + LIFT], [80, -8, 56]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [br, bi] = rings(-4, -8, 84, Y1 + 10, 6, 1.8);
  put(solid(g), prism(P, front, br, bi, 0, BZ));
  mk("path", { d: DEV.map((_, i) => seg(P(2, i * G - 1.5, BZ), P(78, i * G - 1.5, BZ))).join(""), class: "nf lo" }, g);

  const devs = DEV.map((d, i) => {
    const grp = mk("g", {}, g), x0 = CX - d.w / 2;
    const outline = fillet(d.shape, d.shape.map(() => d.r));
    const back = mk("path", { class: "lo" }, grp), face = mk("path", { class: "sil" }, grp), marks = mk("path", { class: "nf lo" }, grp);
    const pins = (d.dots || []).map(() => mk("circle", { r: 0.9, class: "dot off" }, grp));
    return { ...d, i, x0, outline, back, face, marks, pins, a: tween(REST), z: tween(0) };
  });

  function frame(dv, th, lift) {
    const yb = dv.i * G, s = Math.sin(rad(th)), c = Math.cos(rad(th));
    const w = (u, v) => P(dv.x0 + u, yb + v * s, BZ + v * c + lift);
    const wb = (u, v) => P(dv.x0 + u, yb + v * s - TK * c, BZ + v * c + TK * s + lift);
    return { w, wb };
  }
  function draw(dv, th, lift) {
    const { w, wb } = frame(dv, th, lift), [u0, v0, u1, v1] = dv.screen;
    dv.back.setAttribute("d", poly(dv.outline.map(([u, v]) => wb(u, v))));
    dv.face.setAttribute("d", poly(dv.outline.map(([u, v]) => w(u, v))));
    let m = poly(fillet(rect(u0, v0, u1, v1), [1.5, 1.5, 1.5, 1.5]).map(([u, v]) => w(u, v)));
    if (dv.bar) m += seg(w(3, dv.bar), w(dv.w - 3, dv.bar));
    if (dv.notch) m += seg(w(dv.notch[0], dv.notch[2]), w(dv.notch[1], dv.notch[2]));
    if (dv.home) m += seg(w(dv.home[0], dv.home[2]), w(dv.home[1], dv.home[2]));
    dv.marks.setAttribute("d", m);
    dv.pins.forEach((el, k) => place(el, w(dv.dots[k][0], dv.dots[k][1])));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const dv of devs) { draw(dv, tval(dv.a, now), tval(dv.z, now)); if (!tdone(dv.a, now) || !tdone(dv.z, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  // the resting outlines on screen, which never move: the frontmost one holding the point wins
  const rests = devs.map((dv) => { const { w } = frame(dv, REST, 0); return dv.outline.map(([u, v]) => w(u, v)); });
  const inside = (pts, x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const hit = ([x, y]) => { let best = -1; rests.forEach((pts, i) => { if (inside(pts, x, y)) best = i; }); return best; };

  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    devs.forEach((dv, i) => {
      const delay = Math.abs(i - from) * stag;
      tset(dv.a, a < 0 ? REST : i < a ? BACK : i > a ? FWD : 0, now, delay);
      tset(dv.z, i === a ? LIFT : 0, now, delay);
      dv.face.classList.toggle("hi", a < 0 ? dv.name === "phone" : i === a);
    });
    read.textContent = a < 0 ? "rest" : devs[a].name;
    B.wake();
  }

  devs[2].face.classList.add("hi");
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "device-frames",
  means: "Four device frames in a stand: the one under the pointer stands up, and the others lean away in turn.",
  rules: [1, 2, 9, 10],
  range: [0, 40, 90],
  mount,
});
