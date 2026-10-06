/**
 * chat-thread: a phone lying on the desk, and the thread rising off its screen:
 * four message bubbles stepping up and away, tails left for the agent and
 * right for you. The agent's first message, the highest, is bright at rest.
 * The pointer picks a bubble (each tested on its resting plane): it lifts and
 * takes the bright edge, and the thread parts round it, staggered outwards.
 * The slider is the gap it opens.
 */
const {
  Cam, facing, fillet, fit, poly, prism, proj, rings, rrect, seg, unproj,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const PW = 46, PL = 88, BW = 32, BH = 15, LIFT = 7, STEP = 50;
// x0, y0 of each bubble, its height, and which side its tail is on (1 is the agent)
const BUB = [[5, 4, 50, 1], [10, 24, 39, 0], [5, 44, 28, 1], [5, 64, 17, 1]];

function outline(x0, y0, left) {
  const x1 = x0 + BW, y1 = y0 + BH;
  const pts = left
    ? [[x0, y0], [x1, y0], [x1, y1], [x0 + 9, y1], [x0 - 3, y1 + 7], [x0, y1 - 5]]
    : [[x0, y0], [x1, y0], [x1, y1 - 5], [x1 + 3, y1 + 7], [x1 - 9, y1], [x0, y1]];
  return fillet(pts, left ? [3, 3, 3, 1.5, 0.8, 1.5] : [3, 3, 1.5, 0.8, 1.5, 3]);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let gap = value, act = -1;

  const C = Cam(45, 0.5, 2.5);
  fit(C, [[-4, -14, 0], [PW + 4, PL + 14, 0], [PW + 4, -14, 0], [-4, PL + 14, 0], [0, -14, 50 + LIFT], [PW, -14, 50 + LIFT]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [pr, pi] = rings(0, 0, PW, PL, 8, 1.6);
  put(solid(g), prism(P, front, pr, pi, 0, 5));
  const top = (r) => poly(r.map((q) => P(q.u, q.v, 5)));
  mk("path", { d: top(rrect(3.5, 9, PW - 3.5, PL - 9, 3, 4)), class: "nf lo" }, g);
  mk("path", { d: top(rrect(PW / 2 - 6, 3.6, PW / 2 + 6, 5.6, 1, 3)), class: "nf lo" }, g);

  const bubbles = BUB.map(([x0, y0, z, agent], i) => {
    const grp = mk("g", {}, g);
    return {
      i, x0, y0, z, agent, shape: outline(0, 0, agent === 1),
      under: mk("path", { class: "lo" }, grp), face: mk("path", { class: "sil" }, grp), lines: mk("path", { class: "nf lo" }, grp),
      y: tween(y0), h: tween(z), drawn: "",
    };
  });

  function draw(b, y, z) {
    const key = y.toFixed(2) + "," + z.toFixed(2);
    if (key === b.drawn) return;
    b.drawn = key;
    const at = (zz) => b.shape.map(([u, v]) => P(b.x0 + u, y + v, zz));
    b.under.setAttribute("d", poly(at(z - 2.4)));
    b.face.setAttribute("d", poly(at(z)));
    const w = (u, v) => P(b.x0 + u, y + v, z);
    b.lines.setAttribute("d", seg(w(5, 5), w(BW - 5, 5)) + seg(w(5, 10), w(BW - 13, 10)));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of bubbles) { draw(b, tval(b.y, now), tval(b.h, now)); if (!tdone(b.y, now) || !tdone(b.h, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The bubble whose resting plane holds the point; the nearer one wins where two overlap. */
  function hit([sx, sy]) {
    let best = -1;
    for (const b of bubbles) {
      const [x, y] = unproj(C, sx, sy, b.z);
      if (x >= b.x0 - 3 && x <= b.x0 + BW + 3 && y >= b.y0 - 3 && y <= b.y0 + BH + 4) best = b.i;
    }
    return best;
  }

  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    for (const b of bubbles) {
      const dy = a < 0 || b.i === a ? 0 : b.i < a ? -gap : gap, delay = Math.abs(b.i - from) * STEP;
      tset(b.y, b.y0 + dy, now, delay);
      tset(b.h, b.z + (b.i === a ? LIFT : 0), now, delay);
      b.face.classList.toggle("hi", a < 0 ? b.i === 0 : b.i === a);
    }
    read.textContent = a < 0 ? "rest" : `msg ${a + 1}`;
    B.wake();
  }

  bubbles[0].face.classList.add("hi");
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { gap = v; const a = act; act = -2; setActive(a); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "chat-thread",
  means: "A phone and the thread rising off it, the agent's message first: pick a bubble and it lifts out of the thread.",
  rules: [1, 2, 4, 5],
  range: [4, 9, 15],
  mount,
});
