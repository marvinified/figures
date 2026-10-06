/**
 * neural-net: a small feed-forward network standing as a diagram, four columns
 * of nodes in front of their dashed panels, every node joined to every node
 * of the next column. The pointer picks the input node nearest it; its signal
 * runs forward through fixed weights, column by column the slider's step
 * apart, each node coming toward you by how strongly it fires and the edges
 * that carry it darkening. The output
 * that fires most takes the bright edge. At rest the second input is on.
 */
const {
  Cam, clamp, fit, poly, proj, rrect, seg, tween, tset, tval, tdone, mk, pointer, register, disposer, solid,
} = HL;

const LAYERS = [4, 5, 5, 3], DX = 46, DZ = 13, R = 3.6, Z0 = 40, RISE = 15, REST = 1;

/** Fixed weights from a seeded generator, so the network is the same every time. */
let seed = 254;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const W = LAYERS.slice(1).map((n, l) => Array.from({ length: n }, () => Array.from({ length: LAYERS[l] }, () => rnd() * 1.6 - 0.55)));

/** Each layer's activations when input i is on: ReLU, each layer scaled to its strongest. */
function forward(i) {
  const out = [LAYERS[0] > 0 ? Array.from({ length: LAYERS[0] }, (_, k) => (k === i ? 1 : 0)) : []];
  W.forEach((M) => {
    const a = M.map((row) => Math.max(0, row.reduce((s, w, k) => s + w * out[out.length - 1][k], 0)));
    const m = Math.max(...a, 1e-6);
    out.push(a.map((v) => v / m));
  });
  return out;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let STEP = value, act = -1, lit = -1;

  const C = Cam(45, 0.5, 2.25);
  const ext = 2 * DZ + 7;
  fit(C, [-8, 3 * DX + 8].flatMap((x) => [-5, RISE + R].flatMap((y) => [[x, y, Z0 - ext], [x, y, Z0 + ext]])), 200, 166);
  const P = proj(C);

  const g = mk("g", {}, svg);
  const nodes = LAYERS.map((n, l) => Array.from({ length: n }, (_, k) => ({ l, k, x: l * DX, z: Z0 + ((n - 1) / 2 - k) * DZ, a: tween(0, 600) })));
  LAYERS.forEach((n, l) => {
    const h = ((n - 1) / 2) * DZ + 7;
    mk("path", { d: poly(rrect(l * DX - 7, Z0 - h, l * DX + 7, Z0 + h, 4, 4).map((q) => P(q.u, -4, q.v))), class: "nf dash" }, g);
  });
  const edges = [];
  W.forEach((M, l) => M.forEach((row, j) => row.forEach((w, k) => edges.push({ w, a: nodes[l][k], b: nodes[l + 1][j], el: mk("path", { class: "nf lo" }, g), on: false }))));
  const flat = nodes.flat();
  for (const n of flat) n.el = solid(g);

  function draw(now) {
    flat.map((n) => [tval(n.a, now), n]).sort((p, q) => p[0] - q[0]).forEach(([, n]) => g.appendChild(n.el.g));
    for (const n of flat) {
      const y = RISE * tval(n.a, now), [cx, cy] = P(n.x, y, n.z), r = R * C.S;
      n.c = [cx, cy];
      n.el.sil.setAttribute("d", `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`);
      n.el.cr.setAttribute("d", `M${cx - r * 0.55} ${cy - r * 0.2}a${r * 0.6} ${r * 0.6} 0 0 1 ${r * 0.5} ${-r * 0.42}`);
    }
    for (const e of edges) {
      e.el.setAttribute("d", seg(e.a.c, e.b.c));
      const on = e.w > 0 && tval(e.a.a, now) > 0.2 && tval(e.b.a, now) > 0.2;
      if (on !== e.on) { e.on = on; e.el.setAttribute("class", on ? "nf" : "nf lo"); }
    }
  }

  const B = register(stage, (_dt, now) => {
    draw(now);
    return flat.some((n) => !tdone(n.a, now));
  });
  bag.add(B.unregister);

  function apply() {
    const now = performance.now(), a = forward(act < 0 ? REST : act);
    nodes.forEach((layer, l) => layer.forEach((n, k) => tset(n.a, a[l][k], now, l * STEP)));
    const out = a[a.length - 1], best = out.indexOf(Math.max(...out));
    if (best !== lit) { lit = best; nodes[nodes.length - 1].forEach((n, k) => n.el.sil.classList.toggle("hi", k === best)); }
    read.textContent = act < 0 ? "rest" : `in ${act + 1} → out ${best + 1}`;
    B.wake();
  }

  /** The input node nearest the pointer on screen, at its resting place. */
  function hit([sx, sy]) {
    let best = -1, bd = 1e9;
    nodes[0].forEach((n, k) => { const c = P(n.x, 0, n.z), d = Math.hypot(sx - c[0], sy - c[1]); if (d < bd) { bd = d; best = k; } });
    return bd < 70 ? best : -1;
  }
  function setActive(a) { if (a === act) return; act = a; apply(); }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { STEP = clamp(v, 0, 400); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "neural-net",
  means: "A small neural network: the pointer switches on an input, and its signal runs forward layer by layer.",
  rules: [1, 2, 5, 9],
  range: [60, 140, 240],
  mount,
});
