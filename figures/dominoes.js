/**
 * dominoes: fourteen dominoes standing in a gentle arc, their pips on the
 * faces. The pointer's screen x scrubs how far the fall has run, on a spring:
 * behind the front each domino leans on the next, and when the run reaches the
 * end the last one lies flat and the whole row settles into a shingle. At rest
 * two are down and the third is tipping, bright. The slider is the gap.
 */
const {
  Cam, clamp, fit, hull, lerp, open, poly, proj, rrect, run, seg, spring, stepS,
  mk, place, pointer, register, disposer, solid,
} = HL;

const N = 14, H = 26, WD = 13, T = 4.5, F0 = 2.45;
const PIPS = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const FACES = [[6, 4], [3, 1], [5, 5], [2, 0], [4, 6], [1, 3], [6, 2], [0, 5], [3, 3], [5, 1], [2, 4], [6, 6], [1, 0], [4, 2]];

/** The direction toward the camera, from what P does to the three axes. */
function viewDir(P) {
  const o = P(0, 0, 0), e = [P(1, 0, 0), P(0, 1, 0), P(0, 0, 1)].map((p) => [p[0] - o[0], p[1] - o[1]]);
  const a = e.map((v) => v[0]), b = e.map((v) => v[1]);
  const v = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return v[2] < 0 ? v.map((c) => -c) : v;
}

/** A rounded slab: ring and inner in its own (u, v), T thick; at(u, v, t) places it. The crease is the near face's inner run that borders a side. */
function slab(P, V, at, ring, inner, T) {
  const w = (q, t) => P(...at(q.u, q.v, t)), a = at(0, 0, 0), b = at(0, 0, T);
  const tn = (b[0] - a[0]) * V[0] + (b[1] - a[1]) * V[1] + (b[2] - a[2]) * V[2] > 0 ? T : 0, tf = T - tn;
  const n0 = P(...at(0, 0, tn)), f0 = P(...at(0, 0, tf)), o = [f0[0] - n0[0], f0[1] - n0[1]];
  const keep = (q) => { const p = w(q, tn), s = P(...at(q.u + q.nu, q.v + q.nv, tn)); return (s[0] - p[0]) * o[0] + (s[1] - p[1]) * o[1] > 0.01; };
  const r = Math.hypot(o[0], o[1]) > 0.2 ? run(inner, keep) : [];
  return { sil: poly(hull(ring.map((q) => w(q, tn)).concat(ring.map((q) => w(q, tf))))), crease: r.length > 1 ? open(r.map((q) => w(q, tn))) : "", tn };
}

/** The row's pivots: the front foot of each domino and its heading, along an arc. */
function layout(G) {
  const out = [];
  let x = 0, y = 0;
  for (let i = 0; i < N; i++) {
    const ph = lerp(-0.42, 0.5, i / (N - 1));
    out.push({ x, y, hx: Math.cos(ph), hy: Math.sin(ph) });
    const pn = lerp(-0.42, 0.5, (i + 0.5) / (N - 1));
    x += G * Math.cos(pn); y += G * Math.sin(pn);
  }
  const cx = (out[0].x + out[N - 1].x) / 2, cy = (out[0].y + out[N - 1].y) / 2;
  out.forEach((d) => { d.x -= cx; d.y -= cy; });
  return out;
}

/** How far domino i leans to rest its top on the next, leaning by beta, G apart. */
const contact = (beta, G) => beta + Math.asin(clamp((G * Math.cos(beta) - T) / H, -1, 1));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let G = value, row = layout(G), pick = -1;

  const C = Cam(45, 0.5, 1.78);
  const far = layout(20);
  fit(C, far.flatMap((d) => [[d.x, d.y, H + 2], [d.x + d.hx * H, d.y + d.hy * H, 0], [d.x - 8, d.y + 8, 0], [d.x + 8, d.y - 8, 0]]), 200, 170);
  const P = proj(C), V = viewDir(P);
  const ring = rrect(-WD / 2, 0, WD / 2, H, 2.2, 4), inner = rrect(-WD / 2 + 1.1, 1.1, WD / 2 - 1.1, H - 1.1, 1.3, 4);

  const g = mk("g", {}, svg);
  const doms = row.map((_, i) => {
    const el = solid(g), line = mk("path", { class: "nf lo" }, el.g), pips = [];
    FACES[i].forEach((n, half) => PIPS[n].forEach((k) => pips.push({ k, half, c: mk("circle", { r: 0, class: "dot m" }, el.g) })));
    return { el, line, pips, drawn: NaN };
  });

  const sp = spring(F0, { eps: 0.002 });
  let lastF = NaN;

  function draw() {
    const F = sp.x;
    if (F === lastF) return;
    lastF = F;
    const al = new Array(N);
    for (let i = N - 1; i >= 0; i--) {
      const f = clamp(F - i, 0, 1), full = i === N - 1 ? Math.PI / 2 : contact(al[i + 1], G);
      al[i] = f * full;
    }
    row.forEach((d, i) => {
      const D = doms[i], a = al[i];
      if (a === D.drawn) return;
      D.drawn = a;
      const s = Math.sin(a), c = Math.cos(a), wx = -d.hy, wy = d.hx;
      const at = (u, v, t) => [d.x + u * wx + v * d.hx * s - t * d.hx * c, d.y + u * wy + v * d.hy * s - t * d.hy * c, v * c + t * s];
      const q = slab(P, V, at, ring, inner, T), show = q.tn === 0;
      D.el.sil.setAttribute("d", q.sil);
      D.el.cr.setAttribute("d", q.crease);
      D.line.setAttribute("d", show ? seg(P(...at(-WD / 2 + 2.2, H / 2, 0)), P(...at(WD / 2 - 2.2, H / 2, 0))) : "");
      D.pips.forEach((p) => {
        const u = ((p.k % 3) - 1) * 3.4, v = (p.half ? H / 4 : (3 * H) / 4) + (1 - Math.floor(p.k / 3)) * 3.4;
        p.c.setAttribute("r", show ? 0.85 : 0);
        place(p.c, P(...at(u, v, 0)));
      });
    });
    const k = clamp(Math.floor(F), 0, N - 1);
    if (k !== pick) { pick = k; doms.forEach((D, i) => D.el.sil.classList.toggle("hi", i === k)); }
  }

  const B = register(stage, (dt) => { const m = stepS(sp, dt); draw(); return m; });
  bag.add(B.unregister);

  // the run's front from screen x, between the resting feet of the first and last
  let ends = [];
  const measure = () => { ends = [P(row[0].x, row[0].y, 0)[0] - 10, P(row[N - 1].x, row[N - 1].y, 0)[0] + 14]; };
  measure();
  const down = (F) => Math.min(N, Math.floor(F + 0.02));

  bag.add(pointer(stage, {
    move: ([sx]) => {
      sp.t = clamp(((sx - ends[0]) / (ends[1] - ends[0])) * N, 0, N);
      read.textContent = `${down(sp.t)} down`;
      B.wake();
    },
    leave: () => { sp.t = F0; read.textContent = "rest"; B.wake(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { G = v; row = layout(G); measure(); doms.forEach((D) => { D.drawn = NaN; }); lastF = NaN; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "dominoes",
  means: "An arc of dominoes: the pointer runs the fall along the row, and the fallen ones lie shingled on each other.",
  rules: [1, 3, 5, 9],
  range: [12, 16, 20],
  mount,
});
