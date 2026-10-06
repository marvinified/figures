/**
 * stepping-stones: stepping stones laid along a stream that bends across a rounded bed.
 * The pointer is projected onto the bed, and each stone rises toward it by its
 * distance, on its own spring, so the path comes up to meet you wherever you
 * are. At rest the stones make a low swell, the first stone bright. The slider
 * is the reach, in world units.
 */
const {
  Cam, clamp, facing, fit, open, prism, proj, rings, unproj, spring, stepS,
  mk, pointer, put, register, disposer, solid,
} = HL;

const N = 11, L = 160, AMP = 20, HMAX = 17;
const X0 = -12, X1 = L + 12, Y0 = 4, Y1 = 92;
const curve = (t) => [8 + t * (L - 16), 48 + AMP * Math.sin(t * Math.PI * 2)];
const falloff = (u) => (u <= 0 ? 1 : u <= 1 ? 0.1 + 0.9 * (1 - u * u) ** 2 : 0.1);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let R = value, over = null;

  const C = Cam(45, 0.5, 2.05);
  fit(C, [[X0, Y0, -5], [X1, Y1, -5], [X1, Y0, -5], [X0, Y1, -5], [X0, Y0, HMAX], [X1, Y0, HMAX]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [br, bi] = rings(X0, Y0, X1, Y1, 14, 2);
  put(solid(g), prism(P, front, br, bi, -5, 0));
  // the stream's two banks, and its line of current, drawn on the bed
  const bank = (off) => {
    const pts = [];
    for (let k = -8; k <= 56; k++) {
      const [x, y] = curve(k / 48);
      if (x > X0 + 3 && x < X1 - 3) pts.push(P(x, clamp(y + off, Y0 + 3, Y1 - 3), 0));
    }
    return open(pts);
  };
  mk("path", { d: bank(-17) + bank(17), class: "nf" }, g);
  mk("path", { d: bank(0), class: "nf dash" }, g);

  const stones = [];
  for (let k = 0; k < N; k++) {
    const t = k / (N - 1), [x, y] = curve(t);
    const w = 14 + 3 * Math.sin(k * 2.3), d = 13 + 2 * Math.cos(k * 1.7);
    const [ring, inner] = rings(x - w / 2, y - d / 2, x + w / 2, y + d / 2, 6, 1.2);
    const h0 = 2.5 + 5 * Math.exp(-((t - 0.25) ** 2) / 0.02) + 3 * Math.exp(-((t - 0.75) ** 2) / 0.015);
    stones.push({ k, x, y, ring, inner, h0, sp: spring(h0, { eps: 0.04 }), drawn: NaN });
  }
  stones.slice().sort((a, b) => a.x + a.y - (b.x + b.y)).forEach((s) => { s.el = solid(g); });
  const first = stones[0];

  function draw(s) {
    const h = Math.max(0.8, s.sp.x);
    if (h === s.drawn) return;
    s.drawn = h;
    put(s.el, prism(P, front, s.ring, s.inner, 0, h));
  }
  function highlight() {
    for (const s of stones) s.el.sil.classList.toggle("hi", over ? s.sp.t > HMAX * 0.55 : s === first);
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const s of stones) { if (stepS(s.sp, dt)) m = true; draw(s); }
    return m;
  });
  bag.add(B.unregister);

  function retarget() {
    let near = null, nd = Infinity;
    for (const s of stones) {
      if (!over) { s.sp.t = s.h0; continue; }
      const dist = Math.hypot(s.x - over[0], s.y - over[1]);
      s.sp.t = Math.max(s.h0 * 0.6, HMAX * falloff(dist / R));
      if (dist < nd) { nd = dist; near = s; }
    }
    read.textContent = over ? `stone ${near.k + 1}` : "rest";
    highlight();
    B.wake();
  }

  highlight();
  bag.add(pointer(stage, {
    move: (p) => { over = unproj(C, p[0], p[1], 0); retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "stepping-stones",
  means: "Stepping stones across a stream: the ones near the pointer rise to meet it, so the path adapts to where you are.",
  rules: [1, 3, 5, 9],
  range: [20, 34, 56],
  mount,
});
