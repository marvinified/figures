/**
 * nearest-pegs: a tray of pegs scattered in three loose clusters, an embedding space
 * seen from above. The pointer is the query, projected onto the tray floor; the
 * k pegs nearest to it rise, the nearest tallest, staggered by rank on the
 * 700ms lift curve. A dot marks the query on the floor. At rest the clusters
 * stand at their own heights, the tallest bright. The slider is k.
 */
const {
  Cam, facing, fit, prism, proj, rings, unproj, clamp,
  tween, tset, tval, tdone, flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const R = 4.6, X0 = -8, X1 = 158, Y0 = -8, Y1 = 118, LIFT = 34, STEP = 40;
const CL = [[34, 32, 4, 7], [118, 30, 12, 6], [80, 88, 7, 7]];

/** Pegs placed deterministically round the cluster centres, never closer than 11 to each other. */
function scatter() {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pegs = [];
  for (const [cx, cy, h, n] of CL) {
    let tries = 0;
    for (let k = 0; k < n && tries < 400; tries++) {
      const a = rnd() * Math.PI * 2, d = 5 + rnd() * 17, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8;
      if (x < X0 + 9 || x > X1 - 9 || y < Y0 + 9 || y > Y1 - 9) continue;
      if (pegs.some((p) => Math.hypot(p.x - x, p.y - y) < 11)) continue;
      pegs.push({ x, y, h0: h + rnd() * 2.5 }); k++;
    }
  }
  return pegs;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let K = Math.round(value), q = null;

  const C = Cam(45, 0.5, 1.72);
  fit(C, [[X0, Y0, -5], [X1, Y1, -5], [X1, Y0, -5], [X0, Y1, -5], [X0 + 12, Y0 + 12, LIFT], [X1 - 12, Y0 + 12, LIFT]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [tr, ti] = rings(X0, Y0, X1, Y1, 12, 2);
  put(solid(g), prism(P, front, tr, ti, -5, 0));
  const qd = flatDot(g, C, 1.6, "dot off");

  const pegs = scatter();
  pegs.forEach((p, i) => { p.i = i; [p.ring, p.inner] = rings(p.x - R, p.y - R, p.x + R, p.y + R, R, 1.1); p.tw = tween(p.h0); p.drawn = NaN; });
  pegs.slice().sort((a, b) => a.x + a.y - (b.x + b.y)).forEach((p) => { p.el = solid(g); });
  const tallest = pegs.reduce((a, b) => (b.h0 > a.h0 ? b : a));

  function draw(p, h) {
    if (h === p.drawn) return;
    p.drawn = h;
    put(p.el, prism(P, front, p.ring, p.inner, 0, h));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const p of pegs) { draw(p, tval(p.tw, now)); if (!tdone(p.tw, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  function retarget() {
    const now = performance.now();
    if (!q) {
      for (const p of pegs) { tset(p.tw, p.h0, now, 0); p.el.sil.classList.toggle("hi", p === tallest); }
      qd.setAttribute("class", "dot off");
      place(qd, P((X0 + X1) / 2, (Y0 + Y1) / 2, 0));
      read.textContent = "rest";
      B.wake();
      return;
    }
    const ranked = pegs.map((p) => [Math.hypot(p.x - q[0], p.y - q[1]), p]).sort((a, b) => a[0] - b[0]);
    ranked.forEach(([, p], r) => {
      const inSet = r < K;
      tset(p.tw, inSet ? LIFT * (1 - (0.55 * r) / Math.max(1, K - 1)) : 3, now, inSet ? r * STEP : 0);
      p.el.sil.classList.toggle("hi", r === 0);
    });
    qd.setAttribute("class", "dot m");
    place(qd, P(q[0], q[1], 0));
    read.textContent = `peg ${ranked[0][1].i + 1}`;
    B.wake();
  }

  retarget();
  bag.add(pointer(stage, {
    move: (p) => { const w = unproj(C, p[0], p[1], 0); q = [clamp(w[0], X0, X1), clamp(w[1], Y0, Y1)]; retarget(); },
    leave: () => { q = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { K = Math.round(v); if (q) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "nearest-pegs",
  means: "Pegs scattered like embeddings: the pointer is the query, and the k nearest rise, the nearest tallest.",
  rules: [1, 2, 4, 5],
  range: [3, 6, 10],
  mount,
});
