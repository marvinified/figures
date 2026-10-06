/**
 * toolbox: a cantilever toolbox, a bin, two open trays with their
 * compartments, and a lid with its handle. At rest it stands a little open, the first
 * tray bright. The pointer's screen x opens it, on a spring: each layer rides
 * out over the one below and rises, a staircase that stays centred. Its screen y
 * picks a layer, by bands taken from the resting pose, and that layer takes
 * the bright edge. The slider is how far a layer rides out.
 */
const {
  Cam, clamp, facing, fit, poly, prism, proj, rings, rrect, seg, spring, stepS,
  mk, pointer, put, register, disposer, solid,
} = HL;

const W = 62, D = 32, O0 = 0.3, RISE = 9;
const LAYERS = [["bin", 0, 18], ["tray 1", 18, 25], ["tray 2", 25, 32], ["lid", 32, 36]];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let SH = value, pick = -1;

  const C = Cam(45, 0.5, 2.7);
  const E = 1.5 * 26;
  fit(C, [[-E, 0, 0], [W + E, D, 0], [W + E, 0, 0], [-E, D, 0], [-E, 0, 40 + 3 * RISE], [W + E, 0, 40 + 3 * RISE]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);

  const layers = LAYERS.map(([name, z0, z1], k) => {
    const el = solid(g);
    return { k, name, z0, z1, el, top: mk("path", { class: "nf lo" }, el.g), handle: k === 3 ? solid(el.g) : null };
  });
  const sp = spring(O0, { eps: 0.001 });
  let drawn = NaN;

  function draw() {
    const o = clamp(sp.x, 0, 1);
    if (o === drawn) return;
    drawn = o;
    // the staircase stays centred: the bin slides back as the lid rides out
    const at = (k) => [(k - 1.5) * o * SH, k * o * RISE];
    layers.forEach((L) => {
      const [dx, dz] = at(L.k), [ring, inner] = rings(dx, 0, dx + W, D, 4, 1.4), zt = L.z1 + dz;
      put(L.el, prism(P, front, ring, inner, L.z0 + dz, zt));
      const on = (r) => poly(r.map((q) => P(q.u, q.v, zt)));
      if (L.handle) {
        const [hr, hi] = rings(dx + W / 2 - 13, D / 2 - 2.2, dx + W / 2 + 13, D / 2 + 2.2, 2.2, 0.7);
        put(L.handle, prism(P, front, hr, hi, zt, zt + 4));
        L.top.setAttribute("d", "");
      } else {
        // an open tray: its rim and the walls between its compartments
        const rim = on(rrect(dx + 3, 3, dx + W - 3, D - 3, 2.5, 4));
        const walls = L.k === 0 ? seg(P(dx + W * 0.4, 3, zt), P(dx + W * 0.4, D - 3, zt)) : seg(P(dx + W / 3, 3, zt), P(dx + W / 3, D - 3, zt)) + seg(P(dx + (2 * W) / 3, 3, zt), P(dx + (2 * W) / 3, D - 3, zt));
        L.top.setAttribute("d", rim + walls);
      }
    });
  }

  const B = register(stage, (dt) => { const m = stepS(sp, dt); draw(); return m; });
  bag.add(B.unregister);

  // the open-ness from screen x, and the layer from screen y in bands taken at rest
  const sx0 = P(-E * 0.6, D / 2, 0)[0], sx1 = P(W + E * 0.6, D / 2, 0)[0];
  const band = layers.map((L) => P(W / 2 + (L.k - 1.5) * O0 * 19, D, (L.z0 + L.z1) / 2 + L.k * O0 * RISE)[1]);
  function choose([sx, sy]) {
    let best = 0;
    band.forEach((y, k) => { if (Math.abs(sy - y) < Math.abs(sy - band[best])) best = k; });
    return best;
  }
  function highlight() {
    layers.forEach((L) => L.el.sil.classList.toggle("hi", pick < 0 ? L.k === 1 : L.k === pick));
  }

  highlight();
  bag.add(pointer(stage, {
    move: (p) => {
      sp.t = clamp((p[0] - sx0) / (sx1 - sx0), 0, 1);
      const k = choose(p);
      if (k !== pick) { pick = k; highlight(); }
      read.textContent = layers[pick].name;
      B.wake();
    },
    leave: () => { sp.t = O0; pick = -1; highlight(); read.textContent = "rest"; B.wake(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { SH = v; drawn = NaN; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "toolbox",
  means: "A cantilever toolbox: the pointer opens it into a staircase of trays and picks the one to reach into.",
  rules: [1, 3, 5, 9],
  range: [12, 19, 26],
  mount,
});
