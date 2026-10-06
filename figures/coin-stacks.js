/**
 * coin-stacks: six coin stacks on a rounded tray, a portfolio at rest. The
 * pointer picks a stack and the strategy trades into it: it gains coins while
 * its neighbours give some up, staggered outwards from it on the 700ms lift
 * curve. Every coin is a seam on the stack's front. The slider is how many
 * coins one trade moves.
 */
const {
  Cam, clamp, facing, fit, open, poly, prism, proj, ringAt, rings, rrect, run, unproj,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const R = 11, T = 3.2, GAP = 31, STEP = 45;
const REST = [[7, 11, 5], [10, 4, 8]];
const X0 = -R - 9, X1 = 2 * GAP + R + 9, Y0 = -R - 9, Y1 = GAP + R + 9;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let gain = value, act = -1;

  const C = Cam(45, 0.5, 2.3);
  const tops = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) tops.push([i * GAP, j * GAP, (11 + 8) * T]);
  fit(C, [[X0, Y0, -5], [X1, Y1, -5], [X1, Y0, -5], [X0, Y1, -5], ...tops], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [pr, pi] = rings(X0, Y0, X1, Y1, 12, 2);
  put(solid(g), prism(P, front, pr, pi, -5, 0));

  // back to front: ascending i + j
  const stacks = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) {
    const x = i * GAP, y = j * GAP, [ring, inner] = rings(x - R, y - R, x + R, y + R, R, 1.4);
    stacks.push({ i, j, x, y, n0: REST[j][i], ring, inner, rim: rrect(x - R + 3, y - R + 3, x + R - 3, y + R - 3, R - 3, 6) });
  }
  stacks.sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i);
  for (const s of stacks) {
    s.el = solid(g);
    s.seams = mk("path", { class: "nf lo" }, s.el.g);
    s.face = mk("path", { class: "nf lo" }, s.el.g);
    s.tw = tween(s.n0);
    s.drawn = NaN;
  }
  const tallest = stacks.reduce((a, b) => (b.n0 > a.n0 ? b : a));

  function draw(s, n) {
    const h = Math.max(T, n * T);
    if (h === s.drawn) return;
    s.drawn = h;
    put(s.el, prism(P, front, s.ring, s.inner, 0, h));
    const fr = run(s.ring, front), seams = [];
    for (let k = 1; k * T < h - 0.6; k++) seams.push(open(ringAt(P, fr, k * T)));
    s.seams.setAttribute("d", seams.join(""));
    s.face.setAttribute("d", poly(ringAt(P, s.rim, h)));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const s of stacks) { draw(s, tval(s.tw, now)); if (!tdone(s.tw, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The stack whose rest pose holds the point: its side or its lid, the nearest one winning. */
  function hit([sx, sy]) {
    let best = -1;
    stacks.forEach((s, k) => {
      for (let z = 0; z <= s.n0 * T; z += T / 2) {
        const [x, y] = unproj(C, sx, sy, z);
        if (Math.hypot(x - s.x, y - s.y) <= R) { best = k; break; }
      }
    });
    return best;
  }

  function highlight() {
    const on = act < 0 ? tallest : stacks[act];
    for (const s of stacks) s.el.sil.classList.toggle("hi", s === on);
  }

  function retarget() {
    const now = performance.now(), a = stacks[act];
    for (const s of stacks) {
      if (!a) { tset(s.tw, s.n0, now, 0); continue; }
      const d = Math.hypot(s.i - a.i, s.j - a.j);
      const n = s === a ? s.n0 + gain : s.n0 - Math.round(gain * (d <= 1.01 ? 0.5 : 0.25));
      tset(s.tw, clamp(n, 1, 19), now, d * STEP);
    }
    B.wake();
  }

  function setActive(k) {
    if (k === act) return;
    act = k;
    highlight();
    read.textContent = k < 0 ? "rest" : `stack ${stacks[k].j * 3 + stacks[k].i + 1}`;
    retarget();
  }

  highlight();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { gain = Math.round(v); if (act >= 0) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "coin-stacks",
  means: "A portfolio of coin stacks: pick one and the strategy trades into it, drawing coins from its neighbours.",
  rules: [1, 2, 5, 9],
  range: [2, 5, 8],
  mount,
});
