/**
 * tape-reels: the meeting on tape. A reel-to-reel deck lying on the desk, two
 * open reels, the tape running from one round two guide posts past the head
 * and on to the other, and three keys at the front. The pointer's screen x
 * scrubs through the meeting (screen x is the same at every height, and the
 * deck never moves): on a spring, tape winds off one pack onto the other, the
 * packs swell and shrink with it, and the hubs turn. At rest it sits a third
 * of the way in. The head is the one bright mark: now. The slider is how much
 * tape the meeting holds, as the radius of a full pack.
 */
const {
  Cam, clamp, facing, fit, open, poly, prism, proj, rings, rrect, spring, stepS,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const HUB = 6, DZ = 10, FZ = 1.5, PZ = 6, LEN = 46, P0 = 0.35, TURNS = 9;
const LC = [42, 36], RC = [112, 36], GL = [62, 70], GR = [92, 70];
const X0 = -4, X1 = 158, Y0 = -6, Y1 = 82;
const disc = (c, r) => rrect(c[0] - r, c[1] - r, c[0] + r, c[1] + r, r, 14);

/** Where the tape leaves a pack of radius r for the point h, on the side away from the deck's middle. */
function tangent(c, r, h, side) {
  const dx = h[0] - c[0], dy = h[1] - c[1], d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + side * Math.acos(clamp(r / d, -1, 1));
  return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let RMAX = value;

  const C = Cam(45, 0.5, 2.05);
  fit(C, [[X0, Y0, 0], [X1, Y1, 0], [X1, Y0, 0], [X0, Y1, 0], [X0, Y0, DZ + 10], [X1, Y0, DZ + 10]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  const [dr, di] = rings(X0, Y0, X1, Y1, 12, 2);
  put(solid(g), prism(P, front, dr, di, 0, DZ));
  const at = (r, z) => poly(r.map((q) => P(q.u, q.v, z)));

  const reel = (c) => {
    const flange = solid(g), pack = solid(g), wind = mk("path", { class: "nf lo" }, pack.g), hub = solid(g);
    const holes = [0, 1, 2].map(() => flatDot(hub.g, C, 0.9, "dot off"));
    return { c, flange, pack, wind, hub, holes, drawn: "" };
  };
  const L = reel(LC), R = reel(RC);
  const tape = mk("path", { class: "nf" }, g);
  for (const p of [GL, GR]) { const [r, i] = rings(p[0] - 2.6, p[1] - 2.6, p[0] + 2.6, p[1] + 2.6, 2.6, 0.8); put(solid(g), prism(P, front, r, i, DZ, DZ + 10)); }
  const head = solid(g), [hr, hi] = rings(71, 63, 83, 72, 2.6, 1);
  put(head, prism(P, front, hr, hi, DZ, DZ + 9));
  head.sil.classList.add("hi");
  // the tape runs across the head's face, so it is painted after it
  g.appendChild(tape);
  for (let k = 0; k < 3; k++) { const [r, i] = rings(118 + k * 11, 64, 126 + k * 11, 72, 2, 0.8); put(solid(g), prism(P, front, r, i, DZ, DZ + 2.4)); }

  const sp = spring(P0, { eps: 0.0005 });
  let drawnP = NaN, drawnR = NaN, over = false;

  function drawReel(rl, r, turn) {
    const z0 = DZ + FZ, z1 = z0 + PZ, fr = RMAX + 3;
    put(rl.flange, prism(P, front, disc(rl.c, fr), disc(rl.c, fr - 1.2), DZ, z0));
    put(rl.pack, prism(P, front, disc(rl.c, r), disc(rl.c, Math.max(HUB, r - 1.2)), z0, z1));
    rl.wind.setAttribute("d", r > HUB + 4 ? at(disc(rl.c, (r + HUB) / 2), z1) : "");
    const [hr0, hi0] = rings(rl.c[0] - HUB, rl.c[1] - HUB, rl.c[0] + HUB, rl.c[1] + HUB, HUB, 1);
    put(rl.hub, prism(P, front, hr0, hi0, z0, z1 + 2.5));
    rl.holes.forEach((el, k) => {
      const a = turn + (k * 2 * Math.PI) / 3;
      place(el, P(rl.c[0] + Math.cos(a) * 3.4, rl.c[1] + Math.sin(a) * 3.4, z1 + 2.5));
    });
  }

  function draw() {
    const p = clamp(sp.x, 0, 1);
    if (p === drawnP && RMAX === drawnR) return;
    drawnP = p; drawnR = RMAX;
    const full = RMAX * RMAX - HUB * HUB;
    const rl = Math.sqrt(HUB * HUB + (1 - p) * full), rr = Math.sqrt(HUB * HUB + p * full);
    drawReel(L, rl, -p * TURNS);
    drawReel(R, rr, -p * TURNS);
    const zt = DZ + FZ + PZ / 2, a = tangent(LC, rl, GL, 1), b = tangent(RC, rr, GR, -1);
    tape.setAttribute("d", open([a, GL, [71, 73.5], [83, 73.5], GR, b].map((q) => P(q[0], q[1], zt))));
    const m = Math.round(p * LEN * 60);
    read.textContent = over ? `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}` : "rest";
  }

  const B = register(stage, (dt) => { const m = stepS(sp, dt); draw(); return m; });
  bag.add(B.unregister);

  // the meeting's position from screen x, between the two hubs
  const s0 = P(LC[0], LC[1], 0)[0], s1 = P(RC[0], RC[1], 0)[0];
  bag.add(pointer(stage, {
    move: (q) => { over = true; sp.t = clamp((q[0] - s0) / (s1 - s0), 0, 1); drawnP = NaN; B.wake(); },
    leave: () => { over = false; sp.t = P0; drawnP = NaN; B.wake(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { RMAX = v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "tape-reels",
  means: "The meeting on tape: scrub with the pointer and the tape winds from one reel to the other, to that moment.",
  rules: [1, 3, 5, 8],
  range: [17, 21, 25],
  mount,
});
