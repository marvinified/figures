/**
 * agent-tools: an agent at the centre of a ring of six tools, each a block
 * whose lid says what it is: search, code, files, browser, database and a
 * terminal. A dashed cable arcs from the agent to every tool. The pointer
 * picks the tool whose angle about the agent is nearest its own; that tool
 * lifts by the slider's height, its cable goes solid and a call runs out along
 * it, while the last one settles. At rest the agent is wired to search.
 */
const {
  Cam, fit, open, poly, proj, prism, rings, seg, facing, unproj, circ, rad,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const RR = 50, HB = 10, HH = 9, TB = 9, TH = 7, REST = 0;
const NAMES = ["search", "code", "files", "browser", "database", "terminal"];
const ANG = NAMES.map((_, i) => rad(-60 + i * 60));

/** Each tool's lid glyph, strokes in its own (u, v) across a lid of half-width TB. */
const arc = (cu, cv, r, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / n; return [cu + r * Math.cos(a), cv + r * Math.sin(a)]; });
const GLYPHS = [
  [arc(-1, 1, 3.4, 0, Math.PI * 2, 20), [[1.5, -1.5], [5, -5]]],
  [[[-2.5, 3.5], [-5.5, 0], [-2.5, -3.5]], [[2.5, 3.5], [5.5, 0], [2.5, -3.5]], [[1, 4], [-1, -4]]],
  [[[-4, 5], [2, 5], [4.5, 2.5], [4.5, -5], [-4, -5], [-4, 5]], [[2, 5], [2, 2.5], [4.5, 2.5]], [[-2, 0], [2.5, 0]], [[-2, -2.5], [2.5, -2.5]]],
  [[[-5.5, 4.5], [5.5, 4.5], [5.5, -4.5], [-5.5, -4.5], [-5.5, 4.5]], [[-5.5, 2], [5.5, 2]], [[-4, 3.2], [-3.4, 3.2]], [[-2.4, 3.2], [-1.8, 3.2]]],
  [arc(0, 3, 4.5, 0, Math.PI * 2, 20), arc(0, -0.5, 4.5, Math.PI, Math.PI * 2), arc(0, -4, 4.5, Math.PI, Math.PI * 2), [[-4.5, 3], [-4.5, -4]], [[4.5, 3], [4.5, -4]]],
  [[[-4.5, 3], [-1.5, 0], [-4.5, -3]], [[0, -3.5], [4.5, -3.5]]],
];
/** A lid point (u, v) laid so u reads rightward and v upward on screen. */
const lay = (cx, cy, u, v) => [cx + (u - v) * Math.SQRT1_2, cy - (u + v) * Math.SQRT1_2];
const STAR = [[0, 5.5], [1.3, 1.3], [5.5, 0], [1.3, -1.3], [0, -5.5], [-1.3, -1.3], [-5.5, 0], [-1.3, 1.3]];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let LIFT = value, act = -1, sent = 0;

  const C = Cam(45, 0.5, 2.35);
  const box = [];
  for (let a = 0; a < 360; a += 20) box.push([Math.cos(rad(a)) * (RR + TB + 2), Math.sin(rad(a)) * (RR + TB + 2), 0], [Math.cos(rad(a)) * (RR + TB), Math.sin(rad(a)) * (RR + TB), TH + 14]);
  fit(C, box.concat([[0, 0, 40]]), 200, 162);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const tools = NAMES.map((name, i) => {
    const cx = Math.cos(ANG[i]) * RR, cy = Math.sin(ANG[i]) * RR, [ring, inner] = rings(cx - TB, cy - TB, cx + TB, cy + TB, 2.4, 1);
    return { i, name, cx, cy, ring, inner, lift: tween(0), drawn: NaN };
  });
  const hub = { cx: 0, cy: 0 };
  const order = tools.concat([hub]).sort((a, b) => a.cx + a.cy - (b.cx + b.cy));
  for (const o of order) {
    o.el = solid(g); o.marks = mk("path", { class: "nf lo" }, o.el.g);
    if (o === hub) {
      put(o.el, prism(P, front, circ(HB, 48), circ(HB - 1.4, 48), 0, HH));
      o.marks.setAttribute("d", poly(STAR.map(([u, v]) => P(...lay(0, 0, u, v), HH))));
    }
  }
  const cables = tools.map(() => mk("path", { class: "nf dash" }, g));
  const packet = mk("path", { class: "dot" }, g), pr = 1.8 * C.S;

  function draw(t, now) {
    const z = tval(t.lift, now), top = TH + z;
    if (z !== t.drawn) {
      t.drawn = z;
      put(t.el, prism(P, front, t.ring, t.inner, z, top));
      t.marks.setAttribute("d", GLYPHS[t.i].map((s) => open(s.map(([u, v]) => P(...lay(t.cx, t.cy, u, v), top)))).join(""));
    }
    t.path = Array.from({ length: 25 }, (_, k) => {
      const s = k / 24, a = [Math.cos(ANG[t.i]) * HB, Math.sin(ANG[t.i]) * HB, HH], b = [t.cx - Math.cos(ANG[t.i]) * TB, t.cy - Math.sin(ANG[t.i]) * TB, top];
      return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s + 4 * s * (1 - s) * (16 + z)];
    });
    cables[t.i].setAttribute("d", open(t.path.map((p) => P(...p))));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const t of tools) { draw(t, now); if (!tdone(t.lift, now)) moving = true; }
    const s = Math.min(1, (now - sent) / 650), k = act < 0 ? REST : act;
    let d = "";
    if (act >= 0 && s < 1) {
      const e = (s * s * (3 - 2 * s)) * 24, j = Math.min(23, Math.floor(e)), f = e - j, a = tools[k].path[j], b = tools[k].path[j + 1];
      const [x, y] = P(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
      d = `M${x - pr} ${y}a${pr} ${pr} 0 1 0 ${2 * pr} 0a${pr} ${pr} 0 1 0 ${-2 * pr} 0Z`;
      moving = true;
    }
    packet.setAttribute("d", d);
    return moving;
  });
  bag.add(B.unregister);

  /** The tool whose angle about the agent is nearest the pointer's, on the floor. */
  function hit([sx, sy]) {
    const [x, y] = unproj(C, sx, sy, TH / 2), r = Math.hypot(x, y);
    if (r < HB + 2 || r > RR + TB + 24) return -1;
    const a = Math.atan2(y, x);
    let best = 0;
    ANG.forEach((b, i) => { if (Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < Math.abs(Math.atan2(Math.sin(a - ANG[best]), Math.cos(a - ANG[best])))) best = i; });
    return best;
  }

  function apply() {
    const now = performance.now(), k = act < 0 ? REST : act;
    tools.forEach((t, i) => {
      tset(t.lift, i === k ? (act < 0 ? LIFT * 0.4 : LIFT) : 0, now, 0);
      t.el.sil.classList.toggle("hi", i === k);
      cables[i].setAttribute("class", i === k ? "nf" : "nf dash");
    });
    sent = now;
    read.textContent = act < 0 ? "rest" : NAMES[act];
    B.wake();
  }
  function setActive(a) { if (a === act) return; act = a; apply(); }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { LIFT = v; apply(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "agent-tools",
  means: "An agent wired to six tools: the one under the pointer lifts, its cable goes solid and a call runs out to it.",
  rules: [1, 5, 9],
  range: [4, 9, 14],
  mount,
});
