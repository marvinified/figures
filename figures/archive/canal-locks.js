/**
 * canal-locks: a flight of four locks stepping down toward you into a basin,
 * each chamber walled and filled, a guillotine gate in its frame at each
 * chamber's lower end, and a narrowboat in the top lock. The pointer picks the
 * chamber under it: its gate lifts by the slider's height, and a moment later
 * its water runs down to the level of the next, a boat in it going down too;
 * a lock let go shuts its gate first and fills again after.
 * At rest the third lock stands open and drained. Its gate is the bright one.
 */
const {
  Cam, fit, hull, poly, proj, prism, rings, seg, facing, unproj,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const LL = 40, HW = 16, IN = 12, TOPS = [54, 41, 28, 15, 5], REST = 2, DROP = 260;
const X0 = (i) => i * LL, LEN = (i) => (i < 4 ? LL : 30);
const FULL = (i) => TOPS[i] - 2.5;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let LIFT = value, act = -1;

  const C = Cam(45, 0.5, 1.68);
  fit(C, [[0, -HW, 0], [0, HW, 0], [4 * LL + 30, -HW, 0], [4 * LL + 30, HW, 0], [0, -HW, TOPS[0] + 40], [3 * LL, HW, TOPS[3] + 40]], 200, 164);
  const P = proj(C), front = facing(C);
  const block = (parent, x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); const el = solid(parent); put(el, prism(P, front, ring, inner, z0, z1)); return el; };
  const flat = (x0, y0, x1, y1, z) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => P(x, y, z)));

  const g = mk("g", {}, svg);
  const boatRing = rings(-12, -4.6, 12, 4.6, 4.6, 1)[0], boatIn = rings(-12, -4.6, 12, 4.6, 4.6, 1)[1];
  const cabin = rings(-7, -3, 4, 3, 1.2, 0.6);

  const locks = TOPS.map((T, i) => {
    const x0 = X0(i), x1 = x0 + LEN(i), cg = mk("g", {}, g);
    const body = block(cg, x0, -HW, x1, HW, 2, 1, 0, T);
    const ix0 = x0 + 4, ix1 = x1 - 4, rim = poly([[ix0, -IN], [ix1, -IN], [ix1, IN], [ix0, IN]].map(([x, y]) => P(x, y, T)));
    const inside = mk("g", {}, cg);
    const L = { i, T, x0, x1, ix0, ix1, inside, w: tween(FULL(i), 900), gate: null, lift: tween(0), drawn: "" };
    L.walls = mk("path", { class: "nf lo" }, inside);
    L.water = mk("path", { class: "nf" }, inside);
    L.ripple = mk("path", { class: "nf lo" }, inside);
    if (i === 0) { L.boat = solid(inside); L.cabin = solid(inside); }
    // the near walls again, over what is inside: they hide the water and hull below their rim
    mk("path", { d: poly([[ix0, IN, T], [ix1, IN, T], [ix1, -IN, T], [x1, -HW, T], [x1, -HW, 0], [x1, HW, 0], [x0, HW, 0], [x0, HW, T]].map((p) => P(...p))), class: "fo" }, cg);
    mk("path", { d: body.sil.getAttribute("d"), class: "sil nf" }, cg);
    mk("path", { d: body.cr.getAttribute("d"), class: "nf lo" }, cg);
    mk("path", { d: rim, class: "nf" }, cg);
    if (i < 4) {
      block(cg, x1 - 1.5, -HW - 3, x1 + 1.5, -HW, 0.8, 0.4, T, T + 26);
      L.gate = solid(cg);
      block(cg, x1 - 1.5, HW, x1 + 1.5, HW + 3, 0.8, 0.4, T, T + 26);
      block(cg, x1 - 2, -HW - 3, x1 + 2, HW + 3, 1, 0.5, T + 26, T + 29);
    }
    return L;
  });

  function draw(L, now) {
    const w = tval(L.w, now), lift = tval(L.lift, now), key = w.toFixed(3) + "," + lift.toFixed(3);
    if (key === L.drawn) return;
    L.drawn = key;
    const { ix0, ix1, T } = L;
    L.walls.setAttribute("d", [[ix0, -IN], [ix0, IN], [ix1, -IN]].map(([x, y]) => seg(P(x, y, T), P(x, y, w))).join(""));
    L.water.setAttribute("d", flat(ix0, -IN, ix1, IN, w));
    const mx = (ix0 + ix1) / 2;
    L.ripple.setAttribute("d", seg(P(mx + 2, -5, w), P(mx + 10, -5, w)) + seg(P(mx - 9, 6, w), P(mx - 2, 6, w)));
    if (L.boat) {
      const at = (r) => r.map((q) => ({ ...q, u: q.u + mx - 2, v: q.v + 1 }));
      put(L.boat, prism(P, front, at(boatRing), at(boatIn), w - 1, w + 2.4));
      put(L.cabin, prism(P, front, at(cabin[0]), at(cabin[1]), w + 2.4, w + 6.4));
    }
    if (L.gate) {
      const [ring, inner] = rings(-IN - 2, 2, IN + 2, T + 1, 1, 0.5);
      const on = (r) => r.map((q) => [L.x1, q.u, q.v + lift]);
      put(L.gate, { sil: poly(hull(on(ring).map((p) => P(p[0] - 1, p[1], p[2])).concat(on(ring).map((p) => P(p[0] + 1, p[1], p[2]))))), crease: seg(P(L.x1 + 1, -IN - 1, T + lift - 3), P(L.x1 + 1, IN + 1, T + lift - 3)) });
    }
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const L of locks) { draw(L, now); if (!tdone(L.w, now) || !tdone(L.lift, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The chamber under the pointer, its top read on its own rim's level, the nearest first. */
  function hit([sx, sy]) {
    for (let i = locks.length - 2; i >= 0; i--) {
      const L = locks[i], [x, y] = unproj(C, sx, sy, L.T);
      if (x >= L.x0 && x <= L.x1 && Math.abs(y) <= HW + 6) return i;
    }
    return -1;
  }

  function apply() {
    const now = performance.now(), k = act < 0 ? REST : act;
    locks.forEach((L, i) => {
      if (!L.gate) return;
      tset(L.lift, i === k ? LIFT : 0, now, 0);
      tset(L.w, i === k ? FULL(i + 1) : FULL(i), now, i === k ? DROP : 2 * DROP);
      L.gate.sil.classList.toggle("hi", i === k);
    });
    read.textContent = act < 0 ? "rest" : `lock ${act + 1}`;
    B.wake();
  }
  function setActive(a) { if (a === act) return; act = a; apply(); }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { LIFT = v; apply(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "canal-locks",
  means: "A flight of canal locks: the gate of the chamber under the pointer lifts and its water runs down to the next level.",
  rules: [1, 5, 9],
  range: [8, 14, 20],
  mount,
});
