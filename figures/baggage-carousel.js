/**
 * baggage-carousel: an oval belt of slats running round a raised island, six
 * suitcases riding it, each with its handle and its lid seam. The belt never
 * stops. Over the carousel it slows, on a spring, so a bag can be followed,
 * and the bag nearest the pointer on the belt takes the bright edge. Bags
 * behind the island are painted before it and the rest after, nearest last.
 * The slider is the belt's speed.
 */
const {
  Cam, facing, fit, open, prism, proj, rings, rrect, ringAt, run, seg, unproj, reducedMotion,
  spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const LH = 46, RC = 33, BW = 11, ZB = 7, ZI = 12, SLOW = 0.12, SLAT = 6.5;
const BAGS = [[24, 15, 8], [16, 9, 18], [26, 16, 7], [15, 11, 10], [21, 14, 9], [14, 8, 16]];
const LEN = 4 * LH + 2 * Math.PI * RC, GAPS = [0, 0.15, 0.31, 0.5, 0.64, 0.81];

/** The belt's centreline at arc length s: where, and its heading. Clockwise on screen: the far straight runs toward +x. */
function along(s, off = 0) {
  s = ((s % LEN) + LEN) % LEN;
  const r = RC + off, arc = Math.PI * RC;
  if (s < 2 * LH) return { x: -LH + s, y: -r, a: 0 };
  s -= 2 * LH;
  if (s < arc) { const t = s / RC - Math.PI / 2; return { x: LH + r * Math.cos(t), y: r * Math.sin(t), a: t + Math.PI / 2 }; }
  s -= arc;
  if (s < 2 * LH) return { x: LH - s, y: r, a: Math.PI };
  s -= 2 * LH;
  const t = s / RC + Math.PI / 2;
  return { x: -LH + r * Math.cos(t), y: r * Math.sin(t), a: t + Math.PI / 2 };
}

/** A ring turned by a about the origin and moved to (x, y), its normals turned with it. */
const turn = (ring, x, y, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return ring.map((q) => ({ u: x + q.u * c - q.v * s, v: y + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let rate = value, phase = 0, over = null, lit = -1;
  const sp = spring(rate);

  const C = Cam(45, 0.5, 1.66);
  const RO = RC + BW + 4;
  fit(C, [[-LH - RO, -RO, 0], [LH + RO, RO, 0], [LH + RO, -RO, 0], [-LH - RO, RO, 0], [-LH, -RC, ZB + 21], [LH, -RC, ZB + 21]], 200, 166);
  const P = proj(C), front = facing(C);
  const stad = (r, b) => [rrect(-LH - r, -r, LH + r, r, r, 14), rrect(-LH - r + b, -r + b, LH + r - b, r - b, r - b, 14)];

  const g = mk("g", {}, svg);
  const [or, oi] = stad(RO, 2);
  put(solid(g), prism(P, front, or, oi, 0, ZB));
  const slats = mk("path", { class: "nf lo" }, g);
  const gFar = mk("g", {}, g);
  const [ir, ii] = stad(RC - BW - 1, 2.2);
  put(solid(g), prism(P, front, ir, ii, 0, ZI));
  const gNear = mk("g", {}, g);

  const bags = BAGS.map(([l, w, h], k) => {
    const [ring, inner] = rings(-l / 2, -w / 2, l / 2, w / 2, 2.8, 1.1), [hr, hi] = rings(-4, -0.8, 4, 0.8, 0.8, 0.3);
    const el = solid(gFar), seam = mk("path", { class: "nf lo" }, el.g), handle = solid(el.g);
    return { k, h, ring, inner, hr, hi, el, seam, handle, s0: GAPS[k] * LEN, at: null };
  });

  let order = "";
  function draw() {
    let d = "";
    const o0 = ((phase % SLAT) + SLAT) % SLAT;
    for (let s = o0; s < LEN; s += SLAT) d += seg(P(along(s, -BW).x, along(s, -BW).y, ZB), P(along(s, BW).x, along(s, BW).y, ZB));
    slats.setAttribute("d", d);
    for (const b of bags) {
      const c = along(b.s0 + phase), ring = turn(b.ring, c.x, c.y, c.a), z1 = ZB + b.h;
      b.at = c;
      put(b.el, prism(P, front, ring, turn(b.inner, c.x, c.y, c.a), ZB, z1));
      b.seam.setAttribute("d", open(ringAt(P, run(ring, front), ZB + b.h * 0.55)));
      put(b.handle, prism(P, front, turn(b.hr, c.x, c.y, c.a), turn(b.hi, c.x, c.y, c.a), z1, z1 + 2.6));
      const qx = Math.max(-LH, Math.min(LH, c.x));
      b.front = c.x - qx + c.y > 0;
    }
    const sorted = bags.slice().sort((a, b) => a.at.x + a.at.y - (b.at.x + b.at.y));
    const key = sorted.map((b) => b.k + (b.front ? "n" : "f")).join();
    if (key !== order) { order = key; sorted.forEach((b) => (b.front ? gNear : gFar).appendChild(b.el.g)); }
  }

  /** The bag nearest the pointer on the belt, or the first at rest. */
  function light() {
    let best = 0;
    if (over) { let bd = Infinity; bags.forEach((b) => { const dd = Math.hypot(b.at.x - over[0], b.at.y - over[1]); if (dd < bd) { bd = dd; best = b.k; } }); }
    if (best !== lit) { lit = best; bags.forEach((b) => b.el.sil.classList.toggle("hi", b.k === best)); }
    read.textContent = over ? `bag ${best + 1}` : "rest";
  }

  const B = register(stage, (dt) => {
    sp.t = over ? rate * SLOW : rate;
    stepS(sp, dt);
    if (!reducedMotion()) phase += sp.x * dt;
    draw(); light();
    return !reducedMotion();
  });
  bag.add(B.unregister);

  const onCarousel = ([x, y]) => Math.hypot(x - Math.max(-LH, Math.min(LH, x)), y) < RO + 6;
  bag.add(pointer(stage, {
    move: ([sx, sy]) => { const w = unproj(C, sx, sy, ZB); over = onCarousel(w) ? w : null; B.wake(); },
    leave: () => { over = null; B.wake(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { rate = v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "baggage-carousel",
  means: "Suitcases riding a carousel that never stops: over it the belt slows, so you can follow the bag that is yours.",
  rules: [4, 6, 7, 8],
  range: [10, 18, 30],
  mount,
});
