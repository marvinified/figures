/**
 * orrery: a table orrery. A round base with its orbits marked on it, a pillar
 * in the middle with the sun on top, and four arms off the pillar at falling
 * heights, each carrying a planet on a short post. Each goes round in its own
 * time, the inner ones fast and the outer slow, so they come back into line
 * only now and then. The pointer slows time to a crawl and picks the orbit
 * under it; that planet is bright and the read-out names it. The slider is the
 * pace. At rest the second planet is bright.
 */
const {
  Cam, fit, proj, prism, circ, seg, poly, facing, unproj, spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const RB = 53, PR = 2.6, ZP = 21, RS = 6.5;
const ORBIT = [15, 26, 37, 48], PERIOD = [3, 5.5, 9, 14], ARM = [18, 14, 10, 6], SIZE = [2.6, 3.8, 4.4, 3.4], START = [0.4, 2.6, 4.4, 1.2];

/** A ball as a screen circle, with a short crease for its light side. */
function ball(el, [cx, cy], r) {
  el.sil.setAttribute("d", `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`);
  el.cr.setAttribute("d", `M${cx - r * 0.6} ${cy - r * 0.15}a${r * 0.62} ${r * 0.62} 0 0 1 ${r * 0.48} ${-r * 0.45}`);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let pace = value, pick = -1, lit = -2;
  const rate = spring(1, { k: 40, c: 12, eps: 0.002 }), ang = START.slice();

  const C = Cam(45, 0.5, 2.35);
  fit(C, [[-RB, 0, -4], [RB, 0, -4], [0, -RB, -4], [0, RB, -4], [0, 0, ZP + 2 * RS + 2]], 200, 166);
  const P = proj(C), front = facing(C);
  const disc = (r, n = 64) => circ(r, n);

  const g = mk("g", {}, svg);
  put(solid(g), prism(P, front, disc(RB), disc(RB - 2), -4, 0));
  mk("path", { class: "nf dash", d: ORBIT.map((r) => poly(disc(r, 96).map((q) => P(q.u, q.v, 0)))).join("") }, g);
  const shadows = mk("path", { class: "nf lo" }, g);
  const moving = mk("g", {}, g);
  const core = mk("g", {}, moving);
  put(solid(core), prism(P, front, disc(PR, 24), disc(PR - 0.8, 24), 0, ZP));
  const sun = solid(core);
  ball(sun, P(0, 0, ZP + RS), RS * C.S);
  const planets = ORBIT.map((r, i) => {
    const grp = mk("g", {}, moving), arm = mk("path", { class: "sil" }, grp), post = mk("path", { class: "lo" }, grp);
    return { i, grp, arm, post, el: solid(grp), depth: 0 };
  });

  let order = "";
  function draw() {
    shadows.setAttribute("d", planets.map((p) => poly(disc(SIZE[p.i] * 0.8, 20).map((q) => P(ORBIT[p.i] * Math.cos(ang[p.i]) + q.u, ORBIT[p.i] * Math.sin(ang[p.i]) + q.v, 0)))).join(""));
    for (const p of planets) {
      const a = ang[p.i], c = Math.cos(a), s = Math.sin(a), R = ORBIT[p.i], z = ARM[p.i], w = 0.7;
      p.arm.setAttribute("d", poly([P(-s * w, c * w, z), P(R * c - s * w, R * s + c * w, z), P(R * c + s * w, R * s - c * w, z), P(s * w, -c * w, z)]));
      p.post.setAttribute("d", seg(P(R * c, R * s, z), P(R * c, R * s, z + 4)));
      ball(p.el, P(R * c, R * s, z + 4 + SIZE[p.i]), SIZE[p.i] * C.S);
      p.depth = (R * (c + s)) / 2;
    }
    const seq = [...planets.map((p) => ({ d: p.depth, n: p.grp })), { d: 0, n: core }].sort((a, b) => a.d - b.d);
    const key = seq.map((q) => (q.n === core ? "c" : planets.find((p) => p.grp === q.n).i)).join();
    if (key !== order) { order = key; seq.forEach((q) => moving.append(q.n)); }
  }

  const B = register(stage, (dt) => {
    stepS(rate, dt);
    for (let i = 0; i < ang.length; i++) ang[i] += (dt * pace * rate.x * 2 * Math.PI) / PERIOD[i];
    draw();
    return true;
  });
  bag.add(B.unregister);

  function show() {
    const k = pick < 0 ? 1 : pick;
    if (k !== lit) { lit = k; planets.forEach((p) => p.el.sil.classList.toggle("hi", p.i === k)); }
    read.textContent = pick < 0 ? "rest" : `orbit ${pick + 1}, ${PERIOD[pick]} s`;
  }

  /** The orbit nearest the pointer, measured on the plane the arms turn in. */
  function hit([sx, sy]) {
    const [x, y] = unproj(C, sx, sy, ARM[1]), r = Math.hypot(x, y);
    if (r > RB + 6) return -1;
    let best = -1, bd = 1e9;
    ORBIT.forEach((o, i) => { const d = Math.abs(r - o); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function aim(p) { pick = p ? hit(p) : -1; rate.t = pick < 0 ? 1 : 0.12; show(); B.wake(); }

  show();
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { pace = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "orrery",
  means: "An orrery: every planet goes round in its own time; point at an orbit to slow the sky and pick it out.",
  rules: [4, 6, 8],
  range: [0.3, 0.8, 1.6],
  mount,
});
