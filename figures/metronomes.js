/**
 * metronomes: five metronomes in a row on a light board, the board lying on
 * two cans on their sides. Each is a tapered case with a pendulum rod on its
 * face and a slide weight on the rod, and each ticks at a pace a little its
 * own, so at rest they drift apart. The pointer on the board lets it roll: the
 * cans give, the board sways with the sum of the swings, and that small
 * shared motion pulls the pendulums into step, by the slider's coupling. The
 * read-out is how far in step they are. At rest the middle one's weight is bright.
 */
const {
  Cam, fit, hull, open, poly, proj, prism, rings, rrect, ringAt, run, facing, unproj, rad, spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const N = 5, DX = 26, BW = (N - 1) * DX + 26, BD = 14, ZB = 9, HB = 30, ARM = 25, SWING = 34;
const PACE = [0.94, 1.03, 0.98, 1.07, 0.96], START = [0, 2.2, 4.1, 1.3, 5.2];
const X = (i) => (i - (N - 1) / 2) * DX;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let K = value, on = false, lit = -2;
  const couple = spring(0, { k: 30, c: 11, eps: 0.002 }), sway = spring(0, { k: 60, c: 9, eps: 0.01 });
  const ph = START.slice();

  const C = Cam(45, 0.5, 2.25);
  fit(C, [[-BW / 2 - 4, -BD, 0], [BW / 2 + 4, BD, 0], [-BW / 2, -BD, ZB + 2 + HB + ARM - 4], [BW / 2, BD, ZB + 2 + HB + ARM - 4]], 200, 170);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  /** A can on its side, its axis along y, as the hull of its two end circles and the near end's rim. */
  const can = (x) => {
    const el = solid(g), r = 4.5, ends = [-BD + 2, BD - 2].map((y) => Array.from({ length: 28 }, (_, k) => P(x + Math.cos((k / 28) * 2 * Math.PI) * r, y, r + Math.sin((k / 28) * 2 * Math.PI) * r)));
    el.sil.setAttribute("d", poly(hull(ends[0].concat(ends[1]))));
    el.cr.setAttribute("d", poly(ends[1]));
  };
  can(-BW / 2 + 12); can(BW / 2 - 12);
  const board = solid(g);
  const units = Array.from({ length: N }, (_, i) => {
    const el = solid(g), rod = mk("path", { class: "sil" }, el.g), wt = mk("path", { class: "sil" }, el.g);
    return { i, el, rod, wt };
  });

  const foot = rrect(-6, -5, 6, 5, 2, 4), top = rrect(-2.4, -2, 2.4, 2, 1.2, 4), inner = rrect(-1.8, -1.4, 1.8, 1.4, 0.8, 4);
  const at = (ring, dx, dy) => ring.map((q) => ({ ...q, u: q.u + dx, v: q.v + dy }));

  let drawn = "";
  function draw() {
    const dx = sway.x, key = dx.toFixed(3) + ph.map((p) => p.toFixed(3)).join();
    if (key === drawn) return;
    drawn = key;
    { const [ring, inn] = rings(-BW / 2 + dx, -BD, BW / 2 + dx, BD, 3, 1.2); put(board, prism(P, front, ring, inn, ZB, ZB + 2)); }
    for (const u of units) {
      const x = X(u.i) + dx, z0 = ZB + 2, z1 = z0 + HB;
      u.el.sil.setAttribute("d", poly(hull(ringAt(P, at(foot, x, 0), z0).concat(ringAt(P, at(top, x, 0), z1)))));
      u.el.cr.setAttribute("d", open(ringAt(P, run(at(inner, x, 0), front), z1)));
      const a = rad(SWING) * Math.sin(ph[u.i]), s = Math.sin(a), c = Math.cos(a), py = 5.4, pz = z0 + 5;
      const on = (t, w) => { const z = pz + c * t - s * w; return P(x + s * t + c * w, py - (3 * (z - z0)) / HB, z); };
      u.rod.setAttribute("d", poly([on(-2, -0.5), on(-2, 0.5), on(ARM, 0.5), on(ARM, -0.5)]));
      const m = ARM * 0.62;
      u.wt.setAttribute("d", poly([on(m - 2.2, -2), on(m - 2.2, 2), on(m + 2.2, 2), on(m + 2.2, -2)]));
    }
  }

  const B = register(stage, (dt) => {
    stepS(couple, dt);
    let sx = 0, cx = 0, cy = 0;
    for (let i = 0; i < N; i++) { sx += Math.sin(ph[i]); cx += Math.cos(ph[i]); cy += Math.sin(ph[i]); }
    for (let i = 0; i < N; i++) {
      let pull = 0;
      for (let j = 0; j < N; j++) pull += Math.sin(ph[j] - ph[i]);
      ph[i] += dt * (2 * Math.PI * 0.8 * PACE[i] + ((couple.x * K) / N) * pull);
    }
    sway.t = -couple.x * 1.6 * (sx / N);
    stepS(sway, dt);
    const r = Math.hypot(cx, cy) / N;
    read.textContent = on ? `in step ${Math.round(r * 100)}%` : "rest";
    draw();
    return true;
  });
  bag.add(B.unregister);

  function show() {
    const k = on ? -1 : 2;
    if (k === lit) return;
    lit = k;
    board.sil.classList.toggle("hi", on);
    units.forEach((u) => u.wt.classList.toggle("hi", u.i === k));
  }

  /** Whether the pointer is over the board or what stands on it, on the board's resting plane. */
  function over([sx, sy]) {
    const [x, y] = unproj(C, sx, sy, ZB + 2 + HB / 2);
    return Math.abs(x) < BW / 2 + 6 && Math.abs(y) < BD + 10;
  }
  function setOn(v) { if (v === on) return; on = v; couple.t = v ? 1 : 0; show(); B.wake(); }

  show();
  bag.add(pointer(stage, { move: (p) => setOn(over(p)), leave: () => setOn(false) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { K = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "metronomes",
  means: "Metronomes on a rolling board: let the board move and their small shared sway pulls them into step.",
  rules: [3, 5, 7],
  range: [0.35, 0.9, 1.8],
  mount,
});
