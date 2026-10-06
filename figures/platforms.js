/**
 * platforms: three platforms in a row, tied by two planks that rest on their
 * tops. At rest they stand at three heights and the planks slope between
 * them; the middle one is bright. The pointer picks a platform (each tested
 * on its resting pose), and the other two rise or sink to its level,
 * staggered outwards from it, until the planks lie flat: one surface. Each
 * lid carries its number in dots. The slider is the stagger, in ms.
 */
const {
  Cam, facing, fit, poly, prism, proj, rings, unproj,
  tween, tset, tval, tdone, flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const W = 36, D = 42, GAP = 18, H0 = [36, 24, 12], PY0 = 13, PY1 = D - 13, PK = 1.6;
const X = (i) => i * (W + GAP), X1 = 2 * (W + GAP) + W;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value, act = -1;

  const C = Cam(45, 0.5, 1.95);
  fit(C, [[-8, -8, -5], [X1 + 8, D + 8, -5], [X1 + 8, -8, -5], [-8, D + 8, -5], [0, 0, 36], [X1, 0, 36]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [br, bi] = rings(-8, -8, X1 + 8, D + 8, 10, 2);
  put(solid(g), prism(P, front, br, bi, -5, 0));

  const plats = H0.map((h0, i) => {
    const [ring, inner] = rings(X(i), 0, X(i) + W, D, 5, 1.6);
    const el = solid(g), lid = mk("path", { class: "nf lo" }, el.g), dots = [];
    for (let k = 0; k <= i; k++) dots.push(flatDot(el.g, C, 1.3, "dot off"));
    return { i, h0, ring, inner, lid, dots, el, tw: tween(h0), drawn: NaN };
  });
  const planks = [0, 1].map(() => {
    const grp = mk("g", {}, g);
    return { under: mk("path", { class: "lo" }, grp), face: mk("path", { class: "sil" }, grp) };
  });

  function drawPlat(p, h) {
    if (h === p.drawn) return false;
    p.drawn = h;
    put(p.el, prism(P, front, p.ring, p.inner, 0, h));
    const [lr] = rings(X(p.i) + 5, 5, X(p.i) + W - 5, D - 5, 3, 1);
    p.lid.setAttribute("d", poly(lr.map((q) => P(q.u, q.v, h))));
    p.dots.forEach((el, k) => place(el, P(X(p.i) + W / 2 + (k - p.i / 2) * 5, D - 8.5, h)));
    return true;
  }
  function drawPlank(k, ha, hb) {
    // the high end sits on the taller lid's edge, the low end lies on the lower lid
    const xa = X(k) + W - (ha > hb + 0.5 ? 0 : 7), xb = X(k + 1) + (hb > ha + 0.5 ? 0 : 7), q = (x, y, z) => P(x, y, z);
    planks[k].under.setAttribute("d", poly([q(xa, PY0, ha), q(xb, PY0, hb), q(xb, PY1, hb), q(xa, PY1, ha)]));
    planks[k].face.setAttribute("d", poly([q(xa, PY0, ha + PK), q(xb, PY0, hb + PK), q(xb, PY1, hb + PK), q(xa, PY1, ha + PK)]));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false, changed = false;
    for (const p of plats) { if (drawPlat(p, tval(p.tw, now))) changed = true; if (!tdone(p.tw, now)) moving = true; }
    if (changed) for (let k = 0; k < 2; k++) drawPlank(k, plats[k].drawn, plats[k + 1].drawn);
    return moving;
  });
  bag.add(B.unregister);

  /** The platform whose resting pose holds the point, its side or its lid; the nearer wins. */
  function hit([sx, sy]) {
    let best = -1;
    for (const p of plats) for (let z = 0; z <= p.h0; z += 2) {
      const [x, y] = unproj(C, sx, sy, z);
      if (x >= X(p.i) && x <= X(p.i) + W && y >= 0 && y <= D) { best = p.i; break; }
    }
    return best;
  }

  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    for (const p of plats) {
      tset(p.tw, a < 0 ? p.h0 : H0[a], now, Math.abs(p.i - from) * stag);
      p.el.sil.classList.toggle("hi", a < 0 ? p.i === 1 : p.i === a);
    }
    read.textContent = a < 0 ? "rest" : `platform ${a + 1}`;
    B.wake();
  }

  plats[1].el.sil.classList.add("hi");
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "platforms",
  means: "Three platforms at three heights, tied by planks: pick one and the others meet its level, until the planks lie flat.",
  rules: [1, 2, 5, 6],
  range: [0, 70, 140],
  mount,
});
