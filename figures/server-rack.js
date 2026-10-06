/**
 * server-rack: an open-sided rack of seven servers on a plinth, one and two
 * units tall: the short ones vented with two status lights, the tall ones with
 * a row of drive bays, and a handle at each end of every face. The pointer
 * picks the server by its height on the rack's face; it slides out on its
 * rails by the slider's length, its lights come on and it takes the bright
 * edge, while the last one slides home. At rest the third is half out.
 */
const {
  Cam, fit, poly, proj, prism, rings, rrect, seg, facing,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid, place,
} = HL;

const W = 76, D = 40, U = 8, UNITS = [1, 2, 1, 1, 2, 1, 1], Z0 = 6, REST = 2;
const ZS = []; { let z = Z0; for (let i = UNITS.length - 1; i >= 0; i--) { ZS[i] = z; z += UNITS[i] * U; } }
const ZT = Z0 + UNITS.reduce((a, b) => a + b, 0) * U;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let PULL = value, act = -1;

  const C = Cam(45, 0.5, 2.15);
  fit(C, [[-4, -D - 4, 0], [W + 4, -D - 4, 0], [W + 4, 4 + 44, 0], [-4, 4 + 44, 0], [-4, -D - 4, ZT + 4], [W + 4, 4, ZT + 4]], 200, 162);
  const P = proj(C), front = facing(C);
  const block = (x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, ring, inner, z0, z1)); };

  const g = mk("g", {}, svg);
  block(-4, -D - 4, W + 4, 4, 2, 1, 0, Z0);
  block(W, -D - 4, W + 4, -D, 1, 0.5, Z0, ZT);
  block(-4, -D - 4, 0, 4, 1.4, 0.6, Z0, ZT);
  const units = UNITS.map((n, i) => {
    const z0 = ZS[i], z1 = z0 + n * U - 0.8, el = solid(g), [ring, inner] = rings(2, -D, W - 2, 0, 1.4, 0.7);
    const leds = [0, 1].map(() => mk("ellipse", { rx: 0.9 * C.S, ry: 0.9 * C.S, class: "dot off" }, el.g));
    return { i, n, z0, z1, el, ring, inner, leds, face: mk("path", { class: "nf lo" }, el.g), out: tween(0), drawn: NaN };
  });
  const units0 = units.slice().sort((a, b) => a.z0 - b.z0);
  units0.forEach((u) => g.appendChild(u.el.g));
  block(-4, -D - 4, W + 4, 4, 2, 1, ZT, ZT + 4);

  function draw(u, o) {
    if (o === u.drawn) return;
    u.drawn = o;
    const sh = (r) => r.map((q) => ({ ...q, v: q.v + o })), F = (x, z) => P(x, o, z), m = [];
    put(u.el, prism(P, front, sh(u.ring), sh(u.inner), u.z0, u.z1));
    const zc = (u.z0 + u.z1) / 2;
    for (const x of [5, W - 5]) m.push(seg(F(x, u.z0 + 1.6), F(x, u.z1 - 1.6)), seg(F(x - 1.4, u.z0 + 1.6), F(x + 1.4, u.z0 + 1.6)), seg(F(x - 1.4, u.z1 - 1.6), F(x + 1.4, u.z1 - 1.6)));
    if (u.n === 1) for (let x = 24; x <= 54; x += 3) m.push(seg(F(x, u.z0 + 2), F(x, u.z1 - 2)));
    else for (let k = 0; k < 5; k++) { const x0 = 20 + k * 9; m.push(poly(rrect(x0, u.z0 + 2.2, x0 + 7.4, u.z1 - 2.2, 1, 3).map((q) => F(q.u, q.v))), seg(F(x0 + 1.6, zc), F(x0 + 5.8, zc))); }
    u.face.setAttribute("d", m.join(""));
    place(u.leds[0], F(11, zc)); place(u.leds[1], F(14.5, zc));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const u of units) { draw(u, tval(u.out, now)); if (!tdone(u.out, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The server whose face at rest holds the pointer's height, read on the plane of the faces. */
  function hit([sx, sy]) {
    const o = P(0, 0, 0), ex = P(1, 0, 0), ez = P(0, 0, 1);
    const a = ex[0] - o[0], b = ez[0] - o[0], c = ex[1] - o[1], d = ez[1] - o[1], det = a * d - b * c, rx = sx - o[0], ry = sy - o[1];
    const x = (rx * d - b * ry) / det, z = (a * ry - c * rx) / det;
    if (x < -10 || x > W + 10) return -1;
    return units.findIndex((u) => z >= u.z0 - 0.4 && z <= u.z1 + 0.4);
  }

  function apply() {
    const now = performance.now(), k = act < 0 ? REST : act;
    units.forEach((u, i) => {
      tset(u.out, i === k ? (act < 0 ? PULL * 0.5 : PULL) : 0, now, i === k ? 90 : 0);
      u.el.sil.classList.toggle("hi", i === k);
      u.leds.forEach((l, j) => l.setAttribute("class", i === k ? "dot" : j === 0 ? "dot m" : "dot off"));
    });
    read.textContent = act < 0 ? "rest" : `server ${act + 1}`;
    B.wake();
  }
  function setActive(a) { if (a === act) return; act = a; apply(); }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { PULL = v; apply(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "server-rack",
  means: "A rack of servers: the one under the pointer slides out on its rails and its lights come on.",
  rules: [1, 5, 9],
  range: [20, 32, 44],
  mount,
});
