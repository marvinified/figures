/**
 * bookshelf: an open bookcase holding eleven books of mixed heights and
 * thicknesses, each spine banded or labelled, the last one leaning on its
 * neighbour. The pointer picks the book whose resting spine is nearest it on
 * screen; it tips forward and slides out toward the reader, and its neighbours
 * come a little way with it, staggered outwards on the 700ms curve. At rest one book stands
 * half out, bright. The slider is how far a book comes out.
 */
const {
  Cam, fit, hull, open, poly, proj, rings, rrect, run, seg, prism, facing,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const BOOKS = [[7, 38, 0], [9, 45, 1], [6, 34, 2], [8, 41, 0], [10, 47, 1], [6, 32, 2], [7, 43, 0], [9, 37, 1], [5, 30, 2], [8, 40, 0], [7, 46, 1]];
const DB = 22, DC = 27, HT = 54, SIDE = 4, LEAN = 0.36, REST = 4, STEP = 45, TIP = 0.24, NEAR = [1, 0.42, 0.15];

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

/** The books along the shelf: where each foot stands, and the last one leaning left onto the top corner of the one before. */
function shelve() {
  let x = 1;
  const out = BOOKS.map(([w, h, kind], i) => {
    const last = i === BOOKS.length - 1, b = { i, w, h, kind, lean: 0, x };
    if (last) { const prev = BOOKS[i - 1]; b.lean = LEAN; b.x = x + prev[1] * Math.tan(LEAN) - 0.4; }
    x = b.x + w + 0.6;
    return b;
  });
  return { books: out, X1: x + 2 };
}

/** The marks on a spine, in its own (u, v): bands near the head and foot, a label, or rules. */
function spine(w, h, kind) {
  if (kind === 1) return [[[1.3, h * 0.55], [w - 1.3, h * 0.55], [w - 1.3, h * 0.72], [1.3, h * 0.72]], [[1.3, 5], [w - 1.3, 5]]];
  if (kind === 2) return [[[1.2, h - 6], [w - 1.2, h - 6]], [[1.2, h - 8], [w - 1.2, h - 8]], [[1.2, h - 10], [w - 1.2, h - 10]]];
  return [[[1.2, h - 5], [w - 1.2, h - 5]], [[1.2, h - 8], [w - 1.2, h - 8]], [[1.2, 6], [w - 1.2, 6]]];
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let PULL = value, act = -1;
  const { books, X1 } = shelve();

  const C = Cam(45, 0.5, 2.28);
  fit(C, [[-SIDE, -3, -4], [X1 + SIDE, DC + 17, -4], [X1 + SIDE, -3, -4], [-SIDE, DC, -4], [-SIDE, -3, HT + 4], [X1 + SIDE, -3, HT + 4]], 200, 166);
  const P = proj(C), V = viewDir(P), front = facing(C);
  const block = (x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, ring, inner, z0, z1)); };

  const g = mk("g", {}, svg);
  block(-SIDE, -3, X1 + SIDE, 0, 1.5, 0.6, -4, HT + 4);
  block(-SIDE, -3, 0, DC, 1.6, 0.8, -4, HT + 4);
  block(0, 0, X1, DC, 1.2, 1, -4, 0);

  books.forEach((b) => {
    b.ring = rrect(0, 0, b.w, b.h, 1.6, 4); b.inner = rrect(0.9, 0.9, b.w - 0.9, b.h - 0.9, 1, 4);
    b.el = solid(g); b.marks = mk("path", { class: "nf lo" }, b.el.g); b.p = tween(0); b.f = tween(0); b.drawn = "";
    b.cx = P(b.x + b.w / 2 - Math.sin(b.lean) * b.h / 2, DB, b.h / 2)[0];
  });
  block(0, 0, X1, DC, 1.2, 1, HT, HT + 4);
  block(X1, -3, X1 + SIDE, DC, 1.6, 0.8, -4, HT + 4);

  /** Book b slid out by p and tipped forward by f about its front foot, as a finger hooks it by the head. */
  function draw(b, p, f) {
    const key = p.toFixed(3) + "," + f.toFixed(4);
    if (key === b.drawn) return;
    b.drawn = key;
    const s = Math.sin(b.lean), c = Math.cos(b.lean), fs = Math.sin(f), fc = Math.cos(f);
    const at = (u, v, t) => { const y = t - DB, z = u * s + v * c; return [b.x + u * c - v * s, DB + p + y * fc + z * fs, z * fc - y * fs]; };
    const q = slab(P, V, at, b.ring, b.inner, DB);
    b.el.sil.setAttribute("d", q.sil);
    b.el.cr.setAttribute("d", q.crease);
    b.marks.setAttribute("d", spine(b.w, b.h, b.kind).map((m) => (m.length > 2 ? poly(m.map(([u, v]) => P(...at(u, v, DB)))) : seg(P(...at(...m[0], DB)), P(...at(...m[1], DB))))).join(""));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of books) { draw(b, tval(b.p, now), tval(b.f, now)); if (!tdone(b.p, now) || !tdone(b.f, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The book whose resting spine is nearest the pointer's screen x. */
  function hit([sx]) {
    let best = 0;
    books.forEach((b, i) => { if (Math.abs(sx - b.cx) < Math.abs(sx - books[best].cx)) best = i; });
    return best;
  }

  function apply(from) {
    const now = performance.now();
    books.forEach((b, i) => {
      const d = Math.abs(i - (act < 0 ? REST : act));
      const to = act < 0 ? (i === REST ? PULL * 0.45 : 0) : PULL * (NEAR[d] || 0);
      tset(b.p, to, now, Math.abs(i - from) * STEP);
      tset(b.f, act >= 0 && d === 0 ? TIP : 0, now, Math.abs(i - from) * STEP);
      b.el.sil.classList.toggle("hi", i === (act < 0 ? REST : act));
    });
    read.textContent = act < 0 ? "rest" : `vol ${act + 1}`;
    B.wake();
  }
  function setActive(a) { if (a === act) return; const from = a >= 0 ? a : act; act = a; apply(from); }

  apply(REST);
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { PULL = v; apply(act < 0 ? REST : act); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "bookshelf",
  means: "A bookcase of mixed books: the one under the pointer slides out toward you, and its neighbours follow a little.",
  rules: [1, 2, 5, 9],
  range: [7, 12, 17],
  mount,
});
