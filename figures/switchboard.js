/**
 * switchboard: a call centre's switchboard, a patch bay of fifteen jacks with six
 * cords arched between pairs of plugs: six calls in progress, three lines
 * free. At rest one cord is bright. The pointer picks a jack (cells on the
 * resting panel, which never moves); if a call is on it, both its plugs pull
 * up, the near one first, and its cord takes the bright stroke, while the
 * plugs round it lift a little less the farther they are. The slider is the lift.
 */
const {
  Cam, clamp, facing, fit, open, prism, proj, rings, rrect, poly, unproj,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const NC = 5, NR = 3, G = 21, PZ = 7, PH = 7, PR = 3.2, STEP = 60;
const CORDS = [[[0, 0], [2, 1]], [[1, 0], [4, 0]], [[3, 1], [1, 2]], [[0, 2], [2, 2]], [[4, 2], [3, 0]], [[0, 1], [2, 0]]];
const X0 = -12, X1 = (NC - 1) * G + 12, Y0 = -12, Y1 = (NR - 1) * G + 12;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let LIFT = value, act = null;

  const C = Cam(45, 0.5, 2.2);
  fit(C, [[X0, Y0, 0], [X1, Y1, 0], [X1, Y0, 0], [X0, Y1, 0], [X0, Y0, 40], [X1, Y0, 40]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [pr, pi] = rings(X0, Y0, X1, Y1, 8, 2);
  put(solid(g), prism(P, front, pr, pi, 0, PZ));
  const at = (r, x, y, z) => poly(r.map((q) => P(x + q.u, y + q.v, z)));
  const holes = [], rims = [];
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    holes.push(at(rrect(-PR - 1.2, -PR - 1.2, PR + 1.2, PR + 1.2, PR + 1.2, 4), c * G, r * G, PZ));
    rims.push(at(rrect(-1.4, -1.4, 1.4, 1.4, 1.4, 3), c * G, r * G, PZ));
  }
  mk("path", { d: holes.join(""), class: "nf" }, g);
  mk("path", { d: rims.join(""), class: "nf lo" }, g);

  const plugs = [], byJack = new Map();
  CORDS.forEach((pair, k) => pair.forEach(([c, r], end) => {
    const p = { k, end, c, r, tw: tween(0), drawn: NaN };
    plugs.push(p); byJack.set(c + "," + r, p);
  }));
  plugs.slice().sort((a, b) => a.c + a.r - (b.c + b.r)).forEach((p) => { p.el = solid(g); });
  const cords = CORDS.map(() => mk("path", { class: "nf" }, g));

  const top = (p) => PZ + PH + p.drawn;
  function drawPlug(p, l) {
    if (l === p.drawn) return false;
    p.drawn = l;
    const [ring, inner] = rings(p.c * G - PR, p.r * G - PR, p.c * G + PR, p.r * G + PR, PR, 0.9);
    put(p.el, prism(P, front, ring, inner, PZ - 1 + l, top(p)));
    return true;
  }
  function drawCord(k) {
    const [a, b] = plugs.filter((p) => p.k === k), pts = [];
    const ax = a.c * G, ay = a.r * G, bx = b.c * G, by = b.r * G, arch = 12 + Math.hypot(bx - ax, by - ay) * 0.22;
    for (let n = 0; n <= 20; n++) {
      const t = n / 20;
      pts.push(P(ax + (bx - ax) * t, ay + (by - ay) * t, top(a) + (top(b) - top(a)) * t + arch * 4 * t * (1 - t)));
    }
    cords[k].setAttribute("d", open(pts));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    const dirty = new Set();
    for (const p of plugs) { if (drawPlug(p, tval(p.tw, now))) dirty.add(p.k); if (!tdone(p.tw, now)) moving = true; }
    dirty.forEach(drawCord);
    return moving;
  });
  bag.add(B.unregister);

  function hit([sx, sy]) {
    const [x, y] = unproj(C, sx, sy, PZ + PH / 2), c = Math.round(x / G), r = Math.round(y / G);
    if (c < 0 || c >= NC || r < 0 || r >= NR || Math.abs(x - c * G) > G / 2 || Math.abs(y - r * G) > G / 2) return null;
    return { c, r };
  }

  function apply() {
    const now = performance.now(), on = act && byJack.get(act.c + "," + act.r);
    for (const p of plugs) {
      const d = act ? Math.hypot(p.c - act.c, p.r - act.r) : 0;
      const l = !on ? 0 : p.k === on.k ? LIFT : LIFT * 0.35 * clamp(1 - d / 2.5, 0, 1);
      tset(p.tw, l, now, act ? d * STEP : 0);
    }
    cords.forEach((el, k) => el.classList.toggle("hi", on ? k === on.k : k === 1));
    read.textContent = act ? `line ${act.r + 1}·${act.c + 1}` : "rest";
    B.wake();
  }
  function setActive(h) {
    if ((h && act && h.c === act.c && h.r === act.r) || (!h && !act)) return;
    act = h;
    apply();
  }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { LIFT = v; if (act) apply(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "switchboard",
  means: "A switchboard of six calls in progress: pick a line and its cord pulls up out of the bay.",
  rules: [1, 2, 3, 4],
  range: [6, 12, 18],
  mount,
});
