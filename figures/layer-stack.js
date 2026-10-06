/**
 * layer-stack: a screen design exploded into its layers, floating one over the
 * next: the background on its dot grid, the card, the image with its hills and sun, the text lines and the
 * button. The pointer picks the layer under it, the top one first; it slides
 * back out of the stack on its own level and takes the bright edge, the last one sliding
 * back. The slider is the gap between layers. At rest the image is half out.
 */
const {
  Cam, fit, open, proj, prism, rings, facing, unproj, circ,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const H = 64, T = 1.4, OUT = 30, REST = 2;
const NAMES = ["background", "card", "image", "copy", "button"];
/** Each layer's box in its own (u, v), v up the screen design, and its marks. */
const LAYERS = [
  { box: [0, 0, 86, H], r: 4, marks: () => { const m = []; for (let u = 8; u < 86; u += 10) for (let v = 8; v < H; v += 10) m.push([[u - 0.6, v], [u + 0.6, v]]); return m; } },
  { box: [10, 7, 76, 57], r: 4, marks: () => [] },
  { box: [15, 27, 71, 52], r: 2.5, marks: () => [[[17, 30], [30, 43], [39, 35], [47, 42], [69, 30]], circ(3.2, 16).map((q) => [58 + q.u, 45 + q.v]).concat([[61.2, 45]])] },
  { box: [15, 11, 44, 23], r: 1.5, marks: () => [[[17, 20], [41, 20]], [[17, 16.5], [37, 16.5]], [[17, 13.5], [31, 13.5]]] },
  { box: [49, 11, 71, 19], r: 4, marks: () => [[[56, 15], [64, 15]], [[61.5, 17.2], [64, 15], [61.5, 12.8]]] },
];
const at = (u, v) => [u, H - v];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let GAP = value, act = -1;

  const C = Cam(45, 0.5, 2.1);
  fit(C, [[0, 0, 0], [86, 0, 0], [86, H, 0], [0, H, 0], [10, -OUT, 4 * 18 + OUT * 0.6], [76, -OUT, 4 * 18 + OUT * 0.6], [0, H, 4 * 13]], 200, 164);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const layers = LAYERS.map((L, i) => {
    const [u0, v0, u1, v1] = L.box, [ring, inner] = rings(u0, H - v1, u1, H - v0, L.r, 0.8), el = solid(g);
    return { i, L, ring, inner, el, marks: mk("path", { class: "nf lo" }, el.g), out: tween(0), drawn: "" };
  });

  const zOf = (i) => i * GAP;
  function draw(l, now) {
    const o = tval(l.out, now), z = zOf(l.i), key = o.toFixed(3) + "," + z;
    if (key === l.drawn) return;
    l.drawn = key;
    const sh = (r) => r.map((q) => ({ ...q, v: q.v - o })), zz = z;
    put(l.el, prism(P, front, sh(l.ring), sh(l.inner), zz, zz + T));
    l.marks.setAttribute("d", l.L.marks().map((m) => open(m.map(([u, v]) => { const [x, y] = at(u, v); return P(x, y - o, zz + T); }))).join(""));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const l of layers) { draw(l, now); if (!tdone(l.out, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The layer under the pointer, each tested on its resting plane and box, the top one first. */
  function hit([sx, sy]) {
    for (let i = layers.length - 1; i >= 0; i--) {
      const [x, y] = unproj(C, sx, sy, zOf(i) + T), [u0, v0, u1, v1] = LAYERS[i].box;
      if (x >= u0 && x <= u1 && H - y >= v0 && H - y <= v1) return i;
    }
    return -1;
  }

  function apply() {
    const now = performance.now(), k = act < 0 ? REST : act;
    layers.forEach((l, i) => {
      tset(l.out, i === k ? (act < 0 ? OUT * 0.5 : OUT) : 0, now, 0);
      l.el.sil.classList.toggle("hi", i === k);
    });
    read.textContent = act < 0 ? "rest" : NAMES[act];
    B.wake();
  }
  function setActive(a) { if (a === act) return; act = a; apply(); }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { GAP = v; layers.forEach((l) => (l.drawn = "")); B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "layer-stack",
  means: "A screen design exploded into layers: the one under the pointer slides out of the stack.",
  rules: [1, 5, 9],
  range: [8, 13, 18],
  mount,
});
