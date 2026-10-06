/**
 * ripple-pond: a shallow square basin of still water with a grid of round
 * floats on it, each with a short marker stick. The pointer over the water
 * lets a drop fall where it is, again as it moves or every so often while it
 * stays: a ring spreads from each drop, and a float rises and falls as a ring
 * passes under it, less the further it has travelled. The slider is how long a
 * ring carries. The read-out is how many floats are moving. The float nearest
 * the last drop is bright; at rest, the one in the middle. Still water sleeps.
 */
const {
  Cam, fit, proj, prism, rings, circ, seg, poly, facing, unproj, mk, pointer, put, register, disposer, solid,
} = HL;

const COLS = 7, ROWS = 5, D = 14, RF = 3.7, BX = 50, BY = 37, SPEED = 34, WAVE = 13, AMP = 3.4, EVERY = 0.8;
const MID = Math.floor((ROWS * COLS) / 2);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let TAU = value, now = 0, last = -9, at = null, from = null, lit = -2, drawn = "";
  const drops = [];

  const C = Cam(45, 0.5, 2.3);
  fit(C, [[-BX - 4, -BY - 4, -8], [BX + 4, BY + 4, -8], [-BX - 4, BY + 4, 2], [BX + 4, -BY - 4, 2], [0, 0, AMP + 8]], 200, 170);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  { const [ring, inner] = rings(-BX - 4, -BY - 4, BX + 4, BY + 4, 6, 2); put(solid(g), prism(P, front, ring, inner, -8, 0)); }
  const crests = mk("path", { class: "nf lo" }, g);

  const floats = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) floats.push({ i: r * COLS + c, x: (c - (COLS - 1) / 2) * D, y: (r - (ROWS - 1) / 2) * D, h: 0 });
  for (const f of floats.slice().sort((p, q) => p.x + p.y - (q.x + q.y))) { f.el = solid(g); f.stick = mk("path", { class: "lo" }, f.el.g); }
  const disc = (f) => circ(RF, 28).map((q) => ({ ...q, u: q.u + f.x, v: q.v + f.y })), lip = (f) => circ(RF - 0.9, 28).map((q) => ({ ...q, u: q.u + f.x, v: q.v + f.y }));

  /** The water's height at (x, y): a short wave train on each drop's ring, fading with the ring's age. */
  function height(x, y) {
    let h = 0;
    for (const d of drops) {
      const age = now - d.t, off = Math.hypot(x - d.x, y - d.y) - SPEED * age;
      if (off > WAVE) continue;
      h += AMP * Math.exp(-age / TAU) * Math.cos((2 * Math.PI * off) / WAVE) * Math.exp(-((off / WAVE) ** 2) * 1.6);
    }
    return h;
  }

  function draw() {
    let moving = 0, key = "";
    for (const f of floats) { f.h = height(f.x, f.y); if (Math.abs(f.h) > 0.4) moving++; key += f.h.toFixed(2); }
    if (key !== drawn) {
      drawn = key;
      for (const f of floats) {
        put(f.el, prism(P, front, disc(f), lip(f), f.h - 0.6, f.h + 1.2));
        f.stick.setAttribute("d", seg(P(f.x, f.y, f.h + 1.2), P(f.x, f.y, f.h + 6)));
      }
    }
    const clampXY = (x, y) => P(Math.max(-BX - 2, Math.min(BX + 2, x)), Math.max(-BY - 2, Math.min(BY + 2, y)), 0);
    crests.setAttribute("d", drops.filter((d) => Math.exp(-(now - d.t) / TAU) > 0.12).map((d) => poly(circ(SPEED * (now - d.t) + 0.5, 72).map((q) => clampXY(d.x + q.u, d.y + q.v)))).join(""));
    read.textContent = at || drops.length ? `${moving} moving` : "rest";
  }

  function drop(x, y) {
    drops.push({ x, y, t: now });
    if (drops.length > 6) drops.shift();
    last = now; from = [x, y];
    let best = MID, bd = 1e9;
    for (const f of floats) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f.i; } }
    light(best);
  }
  function light(k) { if (k !== lit) { lit = k; floats.forEach((f) => f.el.sil.classList.toggle("hi", f.i === k)); } }

  const B = register(stage, (dt) => {
    now += dt;
    if (at && (now - last > EVERY || Math.hypot(at[0] - from[0], at[1] - from[1]) > 18)) drop(at[0], at[1]);
    while (drops.length && Math.exp(-(now - drops[0].t) / TAU) < 0.03) drops.shift();
    draw();
    if (!at && !drops.length) { light(MID); return false; }
    return true;
  });
  bag.add(B.unregister);

  /** The point on the water under the pointer, if it is over the basin. */
  function over([sx, sy]) {
    const [x, y] = unproj(C, sx, sy, 0);
    return Math.abs(x) < BX && Math.abs(y) < BY ? [x, y] : null;
  }

  light(MID);
  draw();
  bag.add(pointer(stage, { move: (p) => { at = over(p); B.wake(); }, leave: () => { at = null; B.wake(); } }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { TAU = v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "ripple-pond",
  means: "Floats on a pond: drop something in and the ripple lifts each float in turn, less the further it travels.",
  rules: [2, 3, 7],
  range: [0.5, 1, 2],
  mount,
});
