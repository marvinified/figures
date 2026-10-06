/**
 * neural-net: a small feed-forward network standing as a diagram, four columns
 * of nodes in line on their dashed panels, every node joined to every node of
 * the next column. Every node stays in its place but the one under the
 * pointer, which comes out toward you; its signal runs forward through fixed
 * weights, the edges to the node that fires most in each next column
 * darkening one after another by the slider's step. The output at the end of
 * that path takes the bright edge. At rest nothing is out and the second
 * input's output is bright.
 */
const {
  Cam, clamp, fit, poly, proj, rrect, seg, tween, tset, tval, tdone, mk, pointer, register, disposer, solid,
} = HL;

const LAYERS = [4, 5, 5, 3], DX = 46, DZ = 13, R = 3.6, Z0 = 40, RISE = 10, PANEL = -4, REST = 1;
const TAGS = ["in", "h1", "h2", "out"];

/** Fixed weights from a seeded generator, so the network is the same every time. */
let seed = 254;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const W = LAYERS.slice(1).map((n, l) => Array.from({ length: n }, () => Array.from({ length: LAYERS[l] }, () => rnd() * 1.6 - 0.55)));

/** The strongest node of each column from column l0 on, when node i of l0 fires alone: ReLU through the fixed weights. */
function path(l0, i) {
  let a = Array.from({ length: LAYERS[l0] }, (_, k) => (k === i ? 1 : 0));
  const out = [i];
  W.slice(l0).forEach((M) => {
    a = M.map((row) => Math.max(0, row.reduce((s, w, k) => s + w * a[k], 0)));
    out.push(a.indexOf(Math.max(...a)));
  });
  return out;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let STEP = value, act = null, lit = -1;

  const C = Cam(45, 0.5, 2.25);
  const ext = 2 * DZ + 7;
  fit(C, [-8, 3 * DX + 8].flatMap((x) => [PANEL - 1, PANEL + RISE + R].flatMap((y) => [[x, y, Z0 - ext], [x, y, Z0 + ext]])), 200, 166);
  const P = proj(C);

  const g = mk("g", {}, svg);
  const nodes = LAYERS.map((n, l) => Array.from({ length: n }, (_, k) => ({ l, k, x: l * DX, z: Z0 + ((n - 1) / 2 - k) * DZ, a: tween(0, 400), p: tween(0, 300) })));
  LAYERS.forEach((n, l) => {
    const h = ((n - 1) / 2) * DZ + 7;
    mk("path", { d: poly(rrect(l * DX - 7, Z0 - h, l * DX + 7, Z0 + h, 4, 4).map((q) => P(q.u, PANEL, q.v))), class: "nf dash" }, g);
  });
  const edges = [];
  W.forEach((M, l) => M.forEach((row, j) => row.forEach((w, k) => edges.push({ w, a: nodes[l][k], b: nodes[l + 1][j], el: mk("path", { class: "nf lo" }, g), on: false }))));
  const flat = nodes.flat();
  for (const n of flat) n.el = solid(g);

  function draw(now) {
    flat.map((n) => [tval(n.a, now), n]).sort((p, q) => p[0] - q[0]).forEach(([, n]) => g.appendChild(n.el.g));
    for (const n of flat) {
      const y = PANEL + RISE * tval(n.a, now), [cx, cy] = P(n.x, y, n.z), r = R * C.S;
      n.c = [cx, cy];
      n.el.sil.setAttribute("d", `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`);
      n.el.cr.setAttribute("d", `M${cx - r * 0.55} ${cy - r * 0.2}a${r * 0.6} ${r * 0.6} 0 0 1 ${r * 0.5} ${-r * 0.42}`);
    }
    for (const e of edges) {
      e.el.setAttribute("d", seg(e.a.c, e.b.c));
      const on = tval(e.a.p, now) > 0.5 && tval(e.b.p, now) > 0.5;
      if (on !== e.on) { e.on = on; e.el.setAttribute("class", on ? "nf" : "nf lo"); }
    }
  }

  const B = register(stage, (_dt, now) => {
    draw(now);
    return flat.some((n) => !tdone(n.a, now) || !tdone(n.p, now));
  });
  bag.add(B.unregister);

  function apply() {
    const now = performance.now(), on = act ? path(act.l, act.k) : null;
    nodes.forEach((layer, l) => layer.forEach((n, k) => {
      tset(n.a, act && act.l === l && act.k === k ? 1 : 0, now, 0);
      tset(n.p, on && l >= act.l && on[l - act.l] === k ? 1 : 0, now, on && l >= act.l ? (l - act.l) * STEP : 0);
    }));
    const best = on ? on[on.length - 1] : path(0, REST)[LAYERS.length - 1];
    if (best !== lit) { lit = best; nodes[nodes.length - 1].forEach((n, k) => n.el.sil.classList.toggle("hi", k === best)); }
    read.textContent = !act ? "rest" : act.l === LAYERS.length - 1 ? `out ${act.k + 1}` : `${TAGS[act.l]} ${act.k + 1} → out ${best + 1}`;
    B.wake();
  }

  /** The node under the pointer: within a node's reach of its resting place, or of where it has come out to. */
  function hit([sx, sy]) {
    let best = null, bd = R * C.S * 1.8;
    for (const n of flat) for (const y of act && act.l === n.l && act.k === n.k ? [PANEL, PANEL + RISE] : [PANEL]) {
      const c = P(n.x, y, n.z), d = Math.hypot(sx - c[0], sy - c[1]);
      if (d < bd) { bd = d; best = { l: n.l, k: n.k }; }
    }
    return best;
  }
  function setActive(a) { if ((a && act && a.l === act.l && a.k === act.k) || (!a && !act)) return; act = a; apply(); }

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
  means: "A small neural network: the node under the pointer comes out, and its signal runs forward layer by layer.",
  rules: [1, 2, 5, 9],
  range: [60, 140, 240],
  mount,
});
