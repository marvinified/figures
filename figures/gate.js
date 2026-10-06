/**
 * gate: five lanes of crates, the agents' output, queued on one plinth
 * behind a single gate, which is you. Two floor lines funnel the lanes into
 * it. At rest the gate is empty and its lintel is bright. The pointer picks a
 * lane: its queue merges into single file and presses into the gate,
 * staggered back from the front, while the other lanes wait. The
 * slider is the stagger, in ms.
 */
const {
  Cam, facing, fit, lerp, open, prism, proj, rings, ringAt, run, unproj,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const CW = 12, CH = 12, G = 24, PITCH = 19, FRONT = 100, GX = 156, YM = 2 * G;
const LEN = [3, 5, 2, 4, 2];
const X0 = FRONT - 4 * PITCH - 13, X1 = GX + 16, Y0 = -14, Y1 = 4 * G + 14, PH = 22;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value, act = -1;

  const C = Cam(45, 0.5, 1.75);
  fit(C, [[X0, Y0, -5], [X1, Y1, -5], [X1, Y0, -5], [X0, Y1, -5], [GX, YM, PH + 4]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [pr, pi] = rings(X0, Y0, X1, Y1, 10, 2);
  put(solid(g), prism(P, front, pr, pi, -5, 0));
  const w = CW / 2 + 4, lanes = [];
  for (let k = 0; k <= LEN.length; k++) lanes.push(open([P(X0 + 6, (k - 0.5) * G, 0), P(FRONT + 10, (k - 0.5) * G, 0)]));
  mk("path", { d: lanes.join(""), class: "nf lo" }, g);
  mk("path", { d: open([P(FRONT + 10, -G / 2, 0), P(GX - 14, YM - w, 0), P(GX - 3, YM - w, 0)]) + open([P(FRONT + 10, 4.5 * G, 0), P(GX - 14, YM + w, 0), P(GX - 3, YM + w, 0)]), class: "nf" }, g);

  const crates = [];
  LEN.forEach((n, lane) => { for (let k = 0; k < n; k++) crates.push({ lane, k, x: tween(FRONT - k * PITCH), y: tween(lane * G), drawn: "" }); });
  const post = (y) => rings(GX - 2, y - 2, GX + 2, y + 2, 2, 0.6);
  const parts = [
    ...crates.map((c) => ({ c, el: solid(g) })),
    { key: GX + YM - w - 1, ring: post(YM - w - 2), el: solid(g) },
    { key: GX + YM + w + 1, ring: post(YM + w + 2), el: solid(g) },
  ];
  crates.forEach((c, i) => { c.el = parts[i].el; c.strap = mk("path", { class: "nf lo" }, c.el.g); });
  for (const p of parts.slice(-2)) put(p.el, prism(P, front, p.ring[0], p.ring[1], 0, PH));
  const lintel = solid(g), [lr, li] = rings(GX - 2.5, YM - w - 4, GX + 2.5, YM + w + 4, 2, 0.7);
  put(lintel, prism(P, front, lr, li, PH, PH + 4));

  /** Paints back to front by where each part is headed. */
  function order() {
    parts.sort((a, b) => (a.c ? a.c.x.to + a.c.y.to : a.key) - (b.c ? b.c.x.to + b.c.y.to : b.key));
    for (const p of parts) g.insertBefore(p.el.g, lintel.g);
  }

  function draw(c, x, y) {
    const key = x.toFixed(2) + "," + y.toFixed(2);
    if (key === c.drawn) return;
    c.drawn = key;
    const [ring, inner] = rings(x - CW / 2, y - CW / 2, x + CW / 2, y + CW / 2, 2.4, 1);
    put(c.el, prism(P, front, ring, inner, 0, CH));
    c.strap.setAttribute("d", open(ringAt(P, run(ring, front), CH * 0.45)));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const c of crates) { draw(c, tval(c.x, now), tval(c.y, now)); if (!tdone(c.x, now) || !tdone(c.y, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The lane whose resting queue holds the point, read at mid-crate height. */
  function hit([sx, sy]) {
    const [x, y] = unproj(C, sx, sy, CH / 2), lane = Math.round(y / G);
    if (lane < 0 || lane >= LEN.length || Math.abs(y - lane * G) > G / 2) return -1;
    return x >= FRONT - (LEN[lane] - 1) * PITCH - CW && x <= FRONT + CW ? lane : -1;
  }

  function setActive(a) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    for (const c of crates) {
      const go = c.lane === a, ly = c.lane * G;
      const [tx, ty] = !go ? [FRONT - c.k * PITCH, ly] : c.k < 3 ? [GX - c.k * PITCH, lerp(YM, ly, [0, 0.25, 0.6][c.k])] : [FRONT - (c.k - 3) * PITCH, ly];
      tset(c.x, tx, now, go ? c.k * stag : 0); tset(c.y, ty, now, go ? c.k * stag : 0);
      c.el.sil.classList.toggle("hi", go && c.k === 0);
    }
    lintel.sil.classList.toggle("hi", a < 0);
    order();
    read.textContent = a < 0 ? "rest" : `lane ${a + 1}`;
    B.wake();
  }

  lintel.sil.classList.add("hi");
  order();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "gate",
  means: "Five lanes of work queued behind one gate: pick a lane and its queue merges into the gate in single file.",
  rules: [1, 2, 4, 6],
  range: [0, 45, 90],
  mount,
});
