/**
 * Fireflies: an oval meeting table on one pedestal, six chairs round it, each
 * a seat and a back. At rest the chairs sit at loose distances, the head of
 * the table bright. The pointer picks the speaker (chairs are tested at their
 * resting places; over the table top only the near chairs count): that chair
 * draws in to the table and the others ease back, in turn round the table.
 * The slider is how far they ease back.
 */
const {
  Cam, facing, fit, prism, proj, rings, rrect, unproj,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const A = 42, BT = 23, SR = 7, SH = 8, TZ = 19, STEP = 55;
// each seat's place on the table's edge and its outward normal
const SEATS = [[-A, 0, -1, 0], [-16, -BT, 0, -1], [16, -BT, 0, -1], [A, 0, 1, 0], [16, BT, 0, 1], [-16, BT, 0, 1]];
const D0 = [9, 13, 7, 11, 15, 8];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let push = value, act = -1;

  const C = Cam(45, 0.5, 2.1);
  const E = A + 30, F = BT + 30;
  fit(C, [[-E, -F, -4], [E, F, -4], [E, -F, -4], [-E, F, -4], [-E, -F, 26]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [fr, fi] = rings(-E, -F, E, F, 16, 2);
  put(solid(svg), prism(P, front, fr, fi, -4, 0));
  svg.appendChild(g);
  const table = { key: 0, els: [] };
  {
    const pg = mk("g", {}, g), ped = solid(pg), top = solid(pg);
    const [pr, pi] = rings(-7, -7, 7, 7, 7, 1);
    put(ped, prism(P, front, pr, pi, 0, TZ));
    put(top, prism(P, front, rrect(-A, -BT, A, BT, BT, 14), rrect(-A + 2, -BT + 2, A - 2, BT - 2, BT - 2, 14), TZ, TZ + 3));
    table.g = pg;
  }
  const chairs = SEATS.map(([sx, sy, nx, ny], i) => {
    const cg = mk("g", {}, g), seat = solid(cg), back = solid(cg);
    return { i, sx, sy, nx, ny, d0: D0[i], g: cg, seat, back, tw: tween(D0[i]), drawn: NaN };
  });
  // back to front by where each chair sits; far chairs go under the table
  [...chairs, table].sort((a, b) => (a.g === table.g ? 0 : a.sx + a.sy) - (b.g === table.g ? 0 : b.sx + b.sy)).forEach((p) => g.appendChild(p.g));

  const centre = (c, d) => [c.sx + c.nx * (d + SR), c.sy + c.ny * (d + SR)];
  function draw(c, d) {
    if (d === c.drawn) return;
    c.drawn = d;
    const [x, y] = centre(c, d), [sr, si] = rings(x - SR, y - SR, x + SR, y + SR, SR, 1);
    put(c.seat, prism(P, front, sr, si, 0, SH));
    const bx = x + c.nx * (SR - 1), by = y + c.ny * (SR - 1), tx = Math.abs(c.ny) * 7 + 1.5, ty = Math.abs(c.nx) * 7 + 1.5;
    const [br, bi] = rings(bx - tx, by - ty, bx + tx, by + ty, 1.4, 0.5);
    put(c.back, prism(P, front, br, bi, SH, SH + 11));
    // the back is behind the seat for the far chairs and in front of it for the near ones
    if (c.nx + c.ny < 0) c.g.insertBefore(c.back.g, c.seat.g); else c.g.appendChild(c.back.g);
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const c of chairs) { draw(c, tval(c.tw, now)); if (!tdone(c.tw, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  function hit([px, py]) {
    const [tx, ty] = unproj(C, px, py, TZ + 3), onTable = (tx / A) ** 2 + (ty / BT) ** 2 <= 1;
    let best = -1, bk = -Infinity;
    for (const c of chairs) {
      const [x, y] = centre(c, c.d0);
      for (let z = 0; z <= SH + 11; z += 2) {
        const [ux, uy] = unproj(C, px, py, z);
        if (Math.hypot(ux - x, uy - y) <= SR + 3) {
          if (!(onTable && c.sx + c.sy < 0) && c.sx + c.sy > bk) { bk = c.sx + c.sy; best = c.i; }
          break;
        }
      }
    }
    return best;
  }

  function apply() {
    const now = performance.now(), from = act >= 0 ? act : 0;
    for (const c of chairs) {
      const ring = Math.min(Math.abs(c.i - from), 6 - Math.abs(c.i - from));
      tset(c.tw, act < 0 ? c.d0 : c.i === act ? 1.5 : 7 + push * (ring / 3), now, ring * STEP);
      c.seat.sil.classList.toggle("hi", act < 0 ? c.i === 0 : c.i === act);
    }
    read.textContent = act < 0 ? "rest" : `seat ${act + 1}`;
    B.wake();
  }
  function setActive(a) { if (a !== act) { act = a; apply(); } }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { push = v; if (act >= 0) apply(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "fireflies",
  means: "Six chairs round a meeting table: pick the speaker and their chair draws in while the others ease back.",
  rules: [1, 2, 4, 6],
  range: [4, 10, 16],
  mount,
});
