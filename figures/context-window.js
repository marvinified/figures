/**
 * context-window: a conversation laid out as a row of message tiles on a long
 * track, yours on the near lane and the model's on the far one, the system
 * prompt first. A context window, its outline on the track, ends where the
 * pointer is and reaches back by the slider's length: the messages inside rise
 * into it, each on its own spring, and the rest stay down. The system prompt is
 * pinned and always in. The newest message inside takes the bright edge. At
 * rest the window holds the latest messages.
 */
const {
  Cam, clamp, fit, poly, proj, prism, rings, rrect, seg, facing, unproj,
  spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const LENS = [12, 9, 14, 7, 11, 16, 8, 12, 10, 15, 7, 13, 9], G = 2.4, LANE = 5.5, DT = 8, LIFT = 7, TT = 2.6;
const MSGS = [];
{ let x = 0; LENS.forEach((l, i) => { MSGS.push({ i, x0: x, x1: x + l, y: i === 0 ? 0 : i % 2 ? LANE : -LANE }); x += l + G; }); }
const END = MSGS[MSGS.length - 1].x1, Y0 = -LANE - DT / 2 - 4, Y1 = LANE + DT / 2 + 4;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let WS = value, over = null, lit = -1;

  const C = Cam(45, 0.5, 1.95);
  fit(C, [[-5, Y0, -3], [END + 5, Y0, -3], [END + 5, Y1, -3], [-5, Y1, -3], [0, Y0, LIFT + TT + 2], [END, Y0, LIFT + TT + 2]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  { const [ring, inner] = rings(-5, Y0, END + 5, Y1, 3, 1.2); put(solid(g), prism(P, front, ring, inner, -3, 0)); }
  mk("path", { d: seg(P(0, 0, 0), P(END, 0, 0)), class: "nf lo" }, g);
  const frame = mk("path", { class: "nf" }, g);
  const wr = spring(END, { eps: 0.05 });

  const tiles = MSGS.map((m) => {
    const [ring, inner] = rings(m.x0, m.y - DT / 2, m.x1, m.y + DT / 2, 1.6, 0.8), el = solid(g);
    return { ...m, ring, inner, el, marks: mk("path", { class: "nf lo" }, el.g), sp: spring(0, { eps: 0.02 }), drawn: NaN };
  });

  function draw(t) {
    const z = t.sp.x;
    if (z === t.drawn) return;
    t.drawn = z;
    const top = z + TT, lines = [];
    if (t.i === 0) lines.push(poly(rrect(t.x0 + 2, -1.6, t.x0 + 5.2, 1.6, 1.6, 3).map((q) => P(q.u, q.v, top))));
    const a = t.i === 0 ? t.x0 + 7 : t.x0 + 2;
    lines.push(seg(P(a, t.y + 1.2, top), P(t.x1 - 2, t.y + 1.2, top)), seg(P(a, t.y - 1.4, top), P(Math.max(a + 1, t.x1 - 2 - (t.i % 3) * 2), t.y - 1.4, top)));
    put(t.el, prism(P, front, t.ring, t.inner, z, top));
    t.marks.setAttribute("d", lines.join(""));
  }

  /** Which messages the window ending at w holds: the system prompt, and every message whose middle is within WS of w. */
  const inside = (t, w) => t.i === 0 || ((t.x0 + t.x1) / 2 <= w + 0.01 && (t.x0 + t.x1) / 2 >= w - WS);

  function retarget() {
    const w = wr.x;
    let newest = -1;
    for (const t of tiles) { const on = inside(t, w); t.sp.t = on ? LIFT : 0; if (on && t.i > 0) newest = t.i; }
    if (newest !== lit) { lit = newest; tiles.forEach((t) => t.el.sil.classList.toggle("hi", t.i === newest)); }
    const ids = tiles.filter((t) => t.i > 0 && inside(t, w)).map((t) => t.i);
    const txt = over === null ? "rest" : ids.length ? `msgs ${ids[0]}–${ids[ids.length - 1]}` : "system only";
    if (read.textContent !== txt) read.textContent = txt;
  }

  const B = register(stage, (dt) => {
    let m = stepS(wr, dt);
    retarget();
    for (const t of tiles) { if (stepS(t.sp, dt)) m = true; draw(t); }
    const x0 = clamp(wr.x - WS, -3, END), x1 = clamp(wr.x, 0, END + 3);
    frame.setAttribute("d", x1 - x0 > 2 ? poly(rrect(x0, Y0 + 1.5, x1, Y1 - 1.5, 2.5, 4).map((q) => P(q.u, q.v, 0))) : "");
    return m;
  });
  bag.add(B.unregister);

  function aim() { wr.t = over === null ? END : clamp(over, 8, END); retarget(); B.wake(); }

  for (const t of tiles) t.sp.x = t.sp.t = inside(t, END) ? LIFT : 0;
  aim();
  bag.add(pointer(stage, {
    move: ([sx, sy]) => { const [x, y] = unproj(C, sx, sy, 0); over = x > -20 && x < END + 20 && y > Y0 - 30 && y < Y1 + 30 ? x : null; aim(); },
    leave: () => { over = null; aim(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { WS = v; retarget(); B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "context-window",
  means: "A model's context window over a conversation: the messages inside it rise, and the system prompt is always in.",
  rules: [3, 5, 8],
  range: [36, 60, 90],
  mount,
});
