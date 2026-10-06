/**
 * voice-bars: a voice, as one row of rounded bars on a long plinth. At rest the
 * bars hold the envelope of a spoken phrase, the loudest bright. The pointer's
 * screen x is a moment in the phrase (screen x does not depend on height, so
 * it reads the same over a tall bar as over the floor); the bars round it
 * swell on their springs, the reach falling off with distance, and the one
 * under it takes the bright edge. The slider is the reach, in bars.
 */
const {
  Cam, clamp, facing, fit, open, prism, proj, rings, ringAt, run, spring, stepS,
  mk, pointer, put, register, disposer, solid,
} = HL;

const H0 = [5, 9, 16, 27, 20, 37, 26, 13, 31, 44, 29, 17, 24, 11, 7, 13, 5];
const N = H0.length, PITCH = 10, BW = 6.4, BD = 15, HMAX = 58;
const L = (N - 1) * PITCH, X0 = -12, X1 = L + 12, Y0 = -14, Y1 = BD + 14;
const falloff = (u) => (u >= 1 ? 0 : (1 - u * u) ** 2);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let R = value * PITCH, at = null;

  const C = Cam(45, 0.5, 1.75);
  fit(C, [[X0, Y0, -6], [X1, Y1, -6], [X1, Y0, -6], [X0, Y1, -6], [0, 0, HMAX], [L, 0, HMAX]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [pr, pi] = rings(X0, Y0, X1, Y1, 13, 2);
  put(solid(g), prism(P, front, pr, pi, -6, 0));
  // a groove the bars stand in
  const [gr] = rings(-7, -3, L + 7, BD + 3, 7, 1);
  mk("path", { d: open(ringAt(P, run(gr, (q) => !front(q)), 0)), class: "nf lo" }, g);

  const bars = H0.map((h0, i) => {
    const x = i * PITCH, [ring, inner] = rings(x - BW / 2, 0, x + BW / 2, BD, BW / 2, 1);
    return { i, x, h0, ring, inner, sp: spring(h0, { eps: 0.04 }), el: solid(g), drawn: NaN };
  });
  mk("path", { d: open(ringAt(P, run(gr, front), 0)), class: "nf lo" }, g);
  const loudest = bars.reduce((a, b) => (b.h0 > a.h0 ? b : a));

  function draw(b) {
    const h = Math.max(1, b.sp.x);
    if (h === b.drawn) return;
    b.drawn = h;
    put(b.el, prism(P, front, b.ring, b.inner, 0, h));
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const b of bars) { if (stepS(b.sp, dt)) m = true; draw(b); }
    return m;
  });
  bag.add(B.unregister);

  // world x along the row from screen x: a straight line, the same at every height
  const s0 = P(0, BD / 2, 0)[0], s1 = P(L, BD / 2, 0)[0];
  const toX = (sx) => ((sx - s0) / (s1 - s0)) * L;

  function retarget() {
    for (const b of bars) {
      const f = at === null ? 0 : falloff(Math.abs(b.x - at) / R);
      b.sp.t = at === null ? b.h0 : b.h0 * 0.55 + (HMAX - b.h0 * 0.55) * f;
    }
    const near = at === null ? loudest : bars[clamp(Math.round(at / PITCH), 0, N - 1)];
    for (const b of bars) b.el.sil.classList.toggle("hi", b === near);
    read.textContent = at === null ? "rest" : `bar ${near.i + 1}`;
    B.wake();
  }

  retarget();
  bag.add(pointer(stage, {
    move: (p) => { at = clamp(toX(p[0]), -PITCH, L + PITCH); retarget(); },
    leave: () => { at = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v * PITCH; if (at !== null) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "voice-bars",
  means: "A voice as a row of bars: the phrase swells wherever the pointer listens, falling off with distance.",
  rules: [1, 3, 5, 9],
  range: [1.5, 3, 5.5],
  mount,
});
