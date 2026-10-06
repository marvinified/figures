/**
 * compass-field: twenty pocket compasses in a grid on a board, each a shallow
 * round case with a diamond needle on its pivot, the north half solid. At rest
 * each needle points roughly north, each a little its own way. The pointer is
 * a magnet: every needle within reach swings round to point at it, the near
 * ones first and fully, the far ones late and part way, each by the short way
 * round. The slider is the magnet's reach. The read-out is how many have
 * turned. The needle nearest the pointer is bright; at rest, one in the middle.
 */
const {
  Cam, fit, proj, prism, rings, circ, seg, poly, facing, unproj, spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const COLS = 5, ROWS = 4, D = 22, RC = 8, ZT = 3, LN = 6.8, WN = 2.1;
const BX = ((COLS - 1) / 2) * D + 12, BY = ((ROWS - 1) / 2) * D + 12, REST_LIT = 7;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let REACH = value, mag = null, lit = -2;

  const C = Cam(45, 0.5, 2.2);
  fit(C, [[-BX, -BY, -4], [BX, BY, -4], [-BX, BY, ZT + 1], [BX, -BY, ZT + 1]], 200, 170);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  { const [ring, inner] = rings(-BX, -BY, BX, BY, 5, 1.6); put(solid(g), prism(P, front, ring, inner, -4, 0)); }

  const halo = mk("path", { class: "nf dash" }, g);

  const all = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c, x = (c - (COLS - 1) / 2) * D, y = (r - (ROWS - 1) / 2) * D;
    const rest = -Math.PI / 2 + 0.22 * Math.sin(i * 2.3 + 0.7);
    all.push({ i, x, y, rest, a: spring(rest, { k: 60, c: 9, eps: 0.002 }) });
  }
  const order = all.slice().sort((p, q) => p.x + p.y - (q.x + q.y));
  for (const m of order) {
    m.el = solid(g);
    const ring = circ(RC, 40).map((q) => ({ ...q, u: q.u + m.x, v: q.v + m.y }));
    const inner = circ(RC - 1.2, 40).map((q) => ({ ...q, u: q.u + m.x, v: q.v + m.y }));
    put(m.el, prism(P, front, ring, inner, 0, ZT));
    mk("path", { class: "lo", d: seg(P(m.x, m.y - RC + 1.6, ZT), P(m.x, m.y - RC + 3, ZT)) }, m.el.g);
    m.south = mk("path", { class: "nf" }, m.el.g);
    m.north = mk("path", { class: "sil" }, m.el.g);
  }

  let drawn = "";
  function draw() {
    const key = all.map((m) => m.a.x.toFixed(3)).join() + (mag ? mag.map((v) => v.toFixed(1)).join() + REACH : "");
    if (key === drawn) return;
    drawn = key;
    halo.setAttribute("d", mag ? poly(circ(REACH, 64).map((q) => P(Math.max(-BX, Math.min(BX, mag[0] + q.u)), Math.max(-BY, Math.min(BY, mag[1] + q.v)), ZT))) : "");
    for (const m of all) {
      const t = m.a.x, ux = Math.cos(t), uy = Math.sin(t), z = ZT + 0.6;
      const at = (l, w) => P(m.x + ux * l - uy * w, m.y + uy * l + ux * w, z);
      m.north.setAttribute("d", poly([at(LN, 0), at(0, WN), at(0, -WN)]));
      m.south.setAttribute("d", poly([at(-LN, 0), at(0, WN), at(0, -WN)]));
    }
  }

  const B = register(stage, (dt) => {
    let moving = false;
    for (const m of all) moving = stepS(m.a, dt) || moving;
    draw();
    return moving;
  });
  bag.add(B.unregister);

  /** Aim every needle: toward the magnet by how near it is, by the short way round; the near ones on stiffer springs. */
  function aim() {
    let turned = 0, near = -1, nd = 1e9;
    for (const m of all) {
      let goal = m.rest, k = 60;
      if (mag) {
        const dx = mag[0] - m.x, dy = mag[1] - m.y, d = Math.hypot(dx, dy), w = smooth(1 - d / REACH);
        goal = m.rest + w * wrap(Math.atan2(dy, dx) - m.rest);
        k = 90 / (1 + d / 18);
        if (w > 0.25) turned++;
        if (d < nd) { nd = d; near = m.i; }
      }
      m.a.k = k; m.a.c = 1.5 * Math.sqrt(k);
      m.a.t = m.a.x + wrap(goal - m.a.x);
    }
    const hi = mag ? (nd < D ? near : -1) : REST_LIT;
    if (hi !== lit) { lit = hi; all.forEach((m) => m.north.classList.toggle("hi", m.i === hi)); }
    read.textContent = mag ? `${turned} turned` : "rest";
    B.wake();
  }

  /** The point under the pointer on the compass tops, if it is over the board. */
  function onBoard([sx, sy]) {
    const [x, y] = unproj(C, sx, sy, ZT);
    return Math.abs(x) < BX + 8 && Math.abs(y) < BY + 8 ? [x, y] : null;
  }

  aim();
  bag.add(pointer(stage, { move: (p) => { mag = onBoard(p); aim(); }, leave: () => { mag = null; aim(); } }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { REACH = v; aim(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "compass-field",
  means: "A field of compasses: bring the magnet near and every needle within reach turns to point at it.",
  rules: [2, 3, 4],
  range: [34, 60, 100],
  mount,
});
