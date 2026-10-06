/**
 * cabinets: three cabinets of four drawers on one plinth, one cabinet a
 * machine. At rest each has a different drawer ajar: out of sync. The pointer
 * picks a drawer on any front, and that same drawer slides out of all three,
 * staggered outwards from the cabinet touched, while the others close. The
 * hit test reads the static front faces. The slider is how far a drawer opens.
 */
const {
  Cam, clamp, facing, fit, poly, prism, proj, rings, rrect,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const W = 34, D = 30, H = 56, ROWS = 4, RH = H / ROWS, GAP = 13, NC = 3, STEP = 60;
const AJAR = [[1, 9], [3, 6], [0, 12]];
const X0 = -8, X1 = (NC - 1) * (W + GAP) + W + 8, Y0 = -8, Y1 = D + 10;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let OPEN = value, act = null;

  const C = Cam(45, 0.5, 1.82);
  fit(C, [[X0, Y0, -5], [X1, Y1, -5], [X1, Y0, -5], [X0, Y1 + 26, -5], [X0, Y0, H], [X1, Y0, H]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [pr, pi] = rings(X0, Y0, X1, Y1, 9, 2);
  put(solid(g), prism(P, front, pr, pi, -5, 0));

  const cabs = [];
  for (let c = 0; c < NC; c++) {
    const x0 = c * (W + GAP), x1 = x0 + W;
    const [cr, ci] = rings(x0, 0, x1, D, 4, 1.5);
    put(solid(g), prism(P, front, cr, ci, 0, H));
    const drawers = [];
    // bottom to top, so a drawer above covers the one below it
    for (let r = ROWS - 1; r >= 0; r--) {
      const z0 = (ROWS - 1 - r) * RH + 1.6, z1 = z0 + RH - 3.2;
      const rest = AJAR[c][0] === r ? AJAR[c][1] : 0;
      drawers[r] = { r, z0, z1, rest, tw: tween(rest), el: solid(g), pull: mk("path", { class: "nf" }, g), drawn: NaN };
    }
    cabs.push({ c, x0, x1, drawers });
  }
  const restMark = cabs[2].drawers[AJAR[2][0]];

  function draw(cab, d, e) {
    if (e === d.drawn) return;
    d.drawn = e;
    const yf = D + 0.8 + e, [ring, inner] = rings(cab.x0 + 2.5, D - 3, cab.x1 - 2.5, yf, 2.2, 1);
    put(d.el, prism(P, front, ring, inner, d.z0, d.z1));
    const cx = (cab.x0 + cab.x1) / 2, zc = (d.z0 + d.z1) / 2 + 1.5;
    d.pull.setAttribute("d", poly(rrect(cx - 6, zc - 1.3, cx + 6, zc + 1.3, 1.3, 3).map((q) => P(q.u, yf, q.v))));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const cab of cabs) for (const d of cab.drawers) {
      draw(cab, d, tval(d.tw, now));
      if (!tdone(d.tw, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  // The front faces at rest, as parallelograms: the pointer in each face's own (x, z).
  const o = P(0, D, 0), ex = P(1, D, 0), ez = P(0, D, 1);
  const a = [ex[0] - o[0], ex[1] - o[1]], b = [ez[0] - o[0], ez[1] - o[1]], det = a[0] * b[1] - a[1] * b[0];
  function hit([sx, sy]) {
    const qx = sx - o[0], qy = sy - o[1];
    const x = (qx * b[1] - qy * b[0]) / det, z = (a[0] * qy - a[1] * qx) / det;
    if (z < 0 || z > H) return null;
    const cab = cabs.find((k) => x >= k.x0 - 2 && x <= k.x1 + 2);
    return cab ? { c: cab.c, r: clamp(ROWS - 1 - Math.floor(z / RH), 0, ROWS - 1) } : null;
  }

  function apply() {
    const now = performance.now();
    for (const cab of cabs) for (const d of cab.drawers) {
      const to = !act ? d.rest : d.r === act.r ? OPEN : 0;
      tset(d.tw, to, now, act ? Math.abs(cab.c - act.c) * STEP : 0);
      d.el.sil.classList.toggle("hi", act ? cab.c === act.c && d.r === act.r : d === restMark);
    }
    read.textContent = act ? `drawer ${act.r + 1}` : "rest";
    B.wake();
  }

  function setActive(h) {
    if ((h && act && h.c === act.c && h.r === act.r) || (!h && !act)) return;
    act = h;
    apply();
  }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { OPEN = v; if (act) apply(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "cabinets",
  means: "Three cabinets out of sync: pick a drawer on one and the same drawer slides out of every machine.",
  rules: [1, 2, 3, 5],
  range: [10, 18, 26],
  mount,
});
