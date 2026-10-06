/**
 * responsive-grid: a browser page, its address bar and three dots along the
 * top, holding eight cards in a fluid grid, each card an image block over two
 * lines, and a handle on the page's right edge. The pointer drags the edge: the container widens and narrows on a
 * spring, the cards stretch with it, and when a column no longer fits (the
 * slider is the narrowest a card may be) the grid reflows, every card gliding
 * to its new cell, lifted clear of the others, and the container growing deeper. The handle is bright.
 */
const {
  Cam, clamp, fit, poly, proj, prism, rings, rrect, seg, facing, unproj,
  spring, stepS, mk, pointer, put, register, disposer, solid, flatDot, place,
} = HL;

const N = 8, PAD = 5, TOP = 13, G = 4, CH = 20, WR = [56, 178], REST = 140, ZP = 3, TC = 2.4, HOP = 7, HYS = 4;

/** Columns that fit in width w with cards at least m wide, two to four. */
const colsFor = (w, m) => clamp(Math.floor((w - 2 * PAD + G) / (m + G)), 2, 4);
const depthFor = (cols) => { const rows = Math.ceil(N / cols); return TOP + PAD + rows * CH + (rows - 1) * G; };

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let MIN = value, over = null, cols = colsFor(REST, MIN);

  const C = Cam(45, 0.5, 1.9);
  fit(C, [[0, 0, 0], [WR[1] + 4, 0, 0], [WR[1] + 4, depthFor(4), 0], [0, depthFor(2), 0], [WR[0], depthFor(2), 0], [0, 0, 8 + HOP]], 200, 160);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const page = solid(g), bar = mk("path", { class: "nf lo" }, g);
  [6, 10.5, 15].forEach((x) => place(flatDot(g, C, 1.3, "dot off"), P(x, 4.5, ZP)));
  const cardsG = mk("g", {}, g), handle = solid(g);
  handle.sil.classList.add("hi");
  const W = spring(REST, { eps: 0.05 }), D = spring(depthFor(cols), { eps: 0.05 });
  const cards = Array.from({ length: N }, (_, i) => ({ i, el: solid(cardsG), marks: null, x: spring(0, { eps: 0.03 }), y: spring(0, { eps: 0.03 }), w: spring(10, { eps: 0.03 }), lift: 0, drawn: "" }));
  cards.forEach((c) => { c.marks = mk("path", { class: "nf lo" }, c.el.g); });

  /** Each card's cell for a container of width w in the current columns. */
  function cells(w) {
    const cw = (w - 2 * PAD - (cols - 1) * G) / cols;
    cards.forEach((c) => { c.x.t = PAD + (c.i % cols) * (cw + G); c.y.t = TOP + Math.floor(c.i / cols) * (CH + G); c.w.t = cw; });
  }

  let drawnPage = "";
  function draw() {
    const w = W.x, d = D.x, key = w.toFixed(2) + "," + d.toFixed(2);
    if (key !== drawnPage) {
      drawnPage = key;
      const [ring, inner] = rings(0, 0, w, d, 4, 1.2);
      put(page, prism(P, front, ring, inner, 0, ZP));
      bar.setAttribute("d", seg(P(0.6, 9, ZP), P(w - 0.6, 9, ZP)) + poly(rrect(22, 2.5, Math.max(30, w * 0.55), 6.5, 2, 3).map((q) => P(q.u, q.v, ZP))));
      const [hr, hi] = rings(w - 1.6, d / 2 - 7, w + 1.6, d / 2 + 7, 1.6, 0.6);
      put(handle, prism(P, front, hr, hi, ZP, ZP + 4));
    }
    for (const c of cards) {
      const x = c.x.x, y = c.y.x, cw = Math.max(4, c.w.x), k = [x, y, cw, c.lift].map((v) => v.toFixed(2)).join();
      if (k === c.drawn) continue;
      c.drawn = k;
      const [ring, inner] = rings(x, y, x + cw, y + CH, 2, 0.8), z = ZP + c.lift + TC;
      put(c.el, prism(P, front, ring, inner, ZP + c.lift, z));
      c.marks.setAttribute("d", poly(rrect(x + 2, y + 2, x + cw - 2, y + CH - 7, 1, 3).map((q) => P(q.u, q.v, z))) + seg(P(x + 2, y + CH - 4.4, z), P(x + cw - 2, y + CH - 4.4, z)) + seg(P(x + 2, y + CH - 2.2, z), P(x + Math.max(3, cw * 0.55), y + CH - 2.2, z)));
    }
    cards.slice().sort((a, b) => a.x.x + a.y.x + a.lift * 60 - (b.x.x + b.y.x + b.lift * 60)).forEach((c) => cardsG.appendChild(c.el.g));
  }

  const B = register(stage, (dt) => {
    let m = stepS(W, dt) | stepS(D, dt);
    const nc = colsFor(W.x, MIN);
    if (nc !== cols && colsFor(W.x + (nc > cols ? -HYS : HYS), MIN) === nc) { cols = nc; D.t = depthFor(cols); }
    cells(W.x);
    for (const c of cards) {
      if (stepS(c.x, dt) | stepS(c.y, dt) | stepS(c.w, dt)) m = true;
      c.lift = HOP * clamp((Math.hypot(c.x.t - c.x.x, c.y.t - c.y.x) - 3) / 12, 0, 1);
    }
    draw();
    return !!m;
  });
  bag.add(B.unregister);

  function aim() {
    W.t = over === null ? REST : clamp(over, WR[0], WR[1]);
    read.textContent = over === null ? "rest" : `${colsFor(W.t, MIN)} cols`;
    B.wake();
  }

  cells(REST);
  cards.forEach((c) => { c.x.x = c.x.t; c.y.x = c.y.t; c.w.x = c.w.t; });
  aim();
  bag.add(pointer(stage, {
    move: ([sx, sy]) => { const [x, y] = unproj(C, sx, sy, ZP); over = x > -30 && x < WR[1] + 30 && y > -30 && y < depthFor(2) + 30 ? x : null; aim(); },
    leave: () => { over = null; aim(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { MIN = v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "responsive-grid",
  means: "A responsive grid of cards: drag the container's edge and the cards stretch, then reflow into fewer or more columns.",
  rules: [3, 8],
  range: [28, 36, 46],
  mount,
});
