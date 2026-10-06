/**
 * block-tower: a tower of wooden blocks, three to a layer, each layer laid
 * across the one below, a few blocks already taken out and every block a
 * little off true. The pointer picks a layer by bands taken from the resting
 * tower; that layer's middle block (or the one left) slides out toward the
 * reader, and the matching blocks two and four layers away shift with it,
 * staggered outwards. At rest one block stands half out, bright. The slider is
 * how far a block comes out.
 */
const {
  Cam, facing, fit, prism, proj, rings,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const NL = 11, BW = 8, BL = 24, BH = 4.6, STEP = 45, REST = 6, NEAR = [1, 0, 0.24, 0, 0.08];
const GONE = new Set(["2,1", "4,0", "5,1", "8,2", "10,1"]);
const jit = (j, i) => Math.sin(j * 12.9898 + i * 78.233) * 1.1;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let PULL = value, act = -1;

  const C = Cam(45, 0.5, 2.75);
  fit(C, [[-16, -16, -4], [BL + 16, BL + 16, -4], [BL + 16, -16, -4], [-16, BL + 16, -4], [0, 0, NL * BH], [BL + 23, BL, NL * BH * 0.6], [BL, BL + 23, NL * BH * 0.6]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [pr, pi] = rings(-16, -16, BL + 16, BL + 16, 9, 2);
  put(solid(g), prism(P, front, pr, pi, -4, 0));

  // layer by layer from the bottom, each layer's blocks from the back, so appending is painting back to front
  const layers = [];
  for (let j = 0; j < NL; j++) {
    const blocks = [];
    for (let i = 0; i < 3; i++) {
      if (GONE.has(j + "," + i)) continue;
      blocks.push({ j, i, along: j % 2 ? "y" : "x", off: jit(j, i), el: solid(g), p: tween(0), drawn: NaN });
    }
    layers.push(blocks);
  }
  const all = layers.flat();

  function draw(b, p) {
    if (p === b.drawn) return;
    b.drawn = p;
    const s = b.off + p, a0 = b.i * BW + 0.3, a1 = (b.i + 1) * BW - 0.3, z0 = b.j * BH;
    const [ring, inner] = b.along === "x" ? rings(s, a0, s + BL, a1, 1.5, 0.8) : rings(a0, s, a1, s + BL, 1.5, 0.8);
    put(b.el, prism(P, front, ring, inner, z0, z0 + BH - 0.3));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of all) { draw(b, tval(b.p, now)); if (!tdone(b.p, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The block a layer gives up: its middle one, or the first still there. */
  const target = (j) => layers[j].find((b) => b.i === 1) || layers[j][0];

  // bands at the resting tower's front corner, one per layer
  const band = layers.map((_, j) => P(BL, BL, (j + 0.5) * BH)[1]);
  const xs = [P(0, BL, 0)[0] - 12, P(BL, 0, 0)[0] + 12];
  function hit([sx, sy]) {
    if (sx < xs[0] || sx > xs[1] || sy > band[0] + 14 || sy < band[NL - 1] - 30) return -1;
    let best = 0;
    band.forEach((y, j) => { if (Math.abs(sy - y) < Math.abs(sy - band[best])) best = j; });
    return best;
  }

  function apply(from) {
    const now = performance.now(), a = act < 0 ? REST : act, t = target(a);
    for (const b of all) {
      const d = Math.abs(b.j - a), same = b.i === t.i && b.along === t.along;
      const to = b === t ? (act < 0 ? PULL * 0.5 : PULL) : act >= 0 && same ? PULL * (NEAR[d] || 0) : 0;
      tset(b.p, to, now, Math.abs(b.j - from) * STEP);
      b.el.sil.classList.toggle("hi", b === t);
    }
    read.textContent = act < 0 ? "rest" : `layer ${act + 1}`;
    B.wake();
  }
  function setActive(a) { if (a === act) return; const from = a >= 0 ? a : act; act = a; apply(from); }

  apply(REST);
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { PULL = v; apply(act < 0 ? REST : act); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "block-tower",
  means: "A tower of wooden blocks: the layer under the pointer pushes a block out toward you, and the tower shifts with it.",
  rules: [1, 2, 5, 9],
  range: [10, 16, 21],
  mount,
});
