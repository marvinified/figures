/**
 * note-grid: twelve note cards on a desk, research half sorted. Each card has
 * a slot in a 4 × 3 grid and a scattered pose, a turn and a slip, and its own
 * spring between the two. The far corner is already in order at rest, its
 * first card bright. The pointer is projected onto the desk, and the cards near
 * it fall into their slots, the pull falling off with distance from each
 * slot, which never moves. The slider is the reach.
 */
const {
  Cam, clamp, facing, fillet, fit, poly, prism, proj, rad, rings, seg, unproj, spring, stepS,
  mk, pointer, put, register, disposer, solid,
} = HL;

const NI = 4, NJ = 3, PX = 29, PY = 25, TW = 19, TD = 14, TK = 1.8;
const X0 = -12, X1 = NI * PX + 4, Y0 = -12, Y1 = NJ * PY + 4;
const falloff = (u) => (u >= 1 ? 0 : (1 - u * u) ** 2);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let R = value, over = null;

  const C = Cam(45, 0.5, 2.05);
  fit(C, [[X0, Y0, -5], [X1, Y1, -5], [X1, Y0, -5], [X0, Y1, -5], [X0, Y0, 6]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [dr, di] = rings(X0, Y0, X1, Y1, 10, 2);
  put(solid(g), prism(P, front, dr, di, -5, 0));
  // the grid the notes belong in, ruled on the desk under them
  const slots = [];
  for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
    const [r] = rings(i * PX - 1, j * PY - 1, i * PX + TW + 1, j * PY + TD + 1, 2.5, 0.5);
    slots.push(poly(r.map((q) => P(q.u, q.v, 0))));
  }
  mk("path", { d: slots.join(""), class: "nf dash" }, g);

  const cards = [];
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let k = 0; k <= NI + NJ - 2; k++) for (let i = 0; i < NI; i++) {
    const j = k - i;
    if (j < 0 || j >= NJ) continue;
    const cx = i * PX + TW / 2, cy = j * PY + TD / 2, m0 = clamp(1 - (i + j) * 0.45, 0, 1);
    const grp = mk("g", {}, g);
    cards.push({
      i, j, cx, cy, m0, dx: rnd() * 10, dy: rnd() * 7, th: rnd() * 50, sp: spring(m0, { eps: 0.002 }),
      under: mk("path", { class: "lo" }, grp), face: mk("path", { class: "sil" }, grp), lines: mk("path", { class: "nf lo" }, grp), drawn: NaN,
    });
  }
  const corner = cards[0];

  function draw(c) {
    const m = clamp(c.sp.x, 0, 1);
    if (m === c.drawn) return;
    c.drawn = m;
    const th = rad(c.th * (1 - m)), co = Math.cos(th), si = Math.sin(th);
    const ox = c.cx + c.dx * (1 - m), oy = c.cy + c.dy * (1 - m);
    const w = (u, v, z) => P(ox + u * co - v * si, oy + u * si + v * co, z);
    const shape = fillet([[-TW / 2, -TD / 2], [TW / 2, -TD / 2], [TW / 2, TD / 2], [-TW / 2, TD / 2]], [2, 2, 2, 2]);
    c.under.setAttribute("d", poly(shape.map(([u, v]) => w(u, v, 0))));
    c.face.setAttribute("d", poly(shape.map(([u, v]) => w(u, v, TK))));
    c.lines.setAttribute("d", [-3.5, 0, 3.5].map((v, k) => seg(w(-TW / 2 + 3, v, TK), w(TW / 2 - (k === 2 ? 8 : 3), v, TK))).join(""));
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const c of cards) { if (stepS(c.sp, dt)) m = true; draw(c); }
    return m;
  });
  bag.add(B.unregister);

  function retarget() {
    let near = corner, nd = Infinity;
    for (const c of cards) {
      if (!over) { c.sp.t = c.m0; continue; }
      const d = Math.hypot(c.cx - over[0], c.cy - over[1]);
      c.sp.t = Math.max(c.m0, falloff(d / R));
      if (d < nd) { nd = d; near = c; }
    }
    for (const c of cards) c.face.classList.toggle("hi", c === near);
    read.textContent = over ? `note ${near.i + 1}·${near.j + 1}` : "rest";
    B.wake();
  }

  retarget();
  bag.add(pointer(stage, {
    move: (p) => { over = unproj(C, p[0], p[1], 0); retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "note-grid",
  means: "Research notes scattered on a desk: near the pointer they fall into order, a grid of structured notes.",
  rules: [1, 3, 5, 6],
  range: [22, 40, 60],
  mount,
});
