/**
 * upload-tray: an upload tray with a dashed drop zone, and four files
 * hovering over it in layers, each a sheet with its corner folded. At rest
 * the top file is bright. The pointer picks a file (each tested on its resting
 * plane, the higher winning): it drops into the tray and takes the bright
 * edge, and the files above close the gap it left, staggered outwards from it.
 * The slider is the spacing of the layers.
 */
const {
  Cam, facing, fillet, fit, poly, prism, proj, rings, rrect, seg, unproj,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const N = 4, SW = 30, SL = 38, FOLD = 8, TX0 = -12, TX1 = SW + 22, TY0 = -16, TY1 = SL + 12, TH = 6, BASE = 20, STEP = 50;
const OFF = [[0, 0], [4, -5], [8, -10], [12, -15]];
const SHAPE = fillet([[0, 0], [SW - FOLD, 0], [SW, FOLD], [SW, SL], [0, SL]], [2, 1, 1, 2, 2]);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let gap = value, act = -1;

  const C = Cam(45, 0.5, 2.55);
  fit(C, [[TX0, TY0, 0], [TX1, TY1, 0], [TX1, TY0, 0], [TX0, TY1, 0], [12, -15, BASE + 3 * 17 + 2], [12 + SW, -15, BASE + 3 * 17 + 2]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [tr, ti] = rings(TX0, TY0, TX1, TY1, 8, 2);
  put(solid(g), prism(P, front, tr, ti, 0, TH));
  const on = (r, z) => poly(r.map((q) => P(q.u, q.v, z)));
  mk("path", { d: on(rrect(TX0 + 5, TY0 + 5, TX1 - 5, TY1 - 5, 5, 5), TH), class: "nf lo" }, g);
  mk("path", { d: on(rrect(TX0 + 9, TY0 + 9, TX1 - 9, TY1 - 9, 3, 5), TH), class: "nf dash" }, g);

  const files = OFF.map(([dx, dy], i) => {
    const grp = mk("g", {}, g);
    return {
      i, dx, dy, grp, z: tween(BASE + i * gap),
      under: mk("path", { class: "lo" }, grp), face: mk("path", { class: "sil" }, grp), marks: mk("path", { class: "nf lo" }, grp), drawn: NaN,
    };
  });
  const restZ = (f) => BASE + f.i * gap;

  function draw(f, z) {
    if (z === f.drawn) return;
    f.drawn = z;
    const w = (u, v, zz) => P(f.dx + u, f.dy + v, zz);
    f.under.setAttribute("d", poly(SHAPE.map(([u, v]) => w(u, v, z - 1.6))));
    f.face.setAttribute("d", poly(SHAPE.map(([u, v]) => w(u, v, z))));
    const rows = [12, 18, 24, 30].map((v, k) => seg(w(5, v, z), w(SW - (k === 3 ? 12 : 5), v, z))).join("");
    f.marks.setAttribute("d", seg(w(SW - FOLD, 0, z), w(SW - FOLD, FOLD, z)) + seg(w(SW - FOLD, FOLD, z), w(SW, FOLD, z)) + rows);
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const f of files) { draw(f, tval(f.z, now)); if (!tdone(f.z, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** The file whose resting plane holds the point; the higher one wins where they overlap. */
  function hit([sx, sy]) {
    let best = -1;
    for (const f of files) {
      const [x, y] = unproj(C, sx, sy, restZ(f));
      if (x >= f.dx - 2 && x <= f.dx + SW + 2 && y >= f.dy - 2 && y <= f.dy + SL + 2) best = f.i;
    }
    return best;
  }

  function apply() {
    const now = performance.now(), from = act >= 0 ? act : N - 1;
    for (const f of files) {
      const layer = act < 0 || f.i < act ? f.i : f.i - 1;
      tset(f.z, f.i === act ? TH + 1.6 : BASE + layer * gap, now, Math.abs(f.i - from) * STEP);
      f.face.classList.toggle("hi", act < 0 ? f.i === N - 1 : f.i === act);
    }
    // the dropped file goes under the rest, so the hovering layers still cover it
    const lead = act >= 0 ? files[act].grp : null;
    if (lead) g.insertBefore(lead, files.find((f) => f.i !== act).grp); else files.forEach((f) => g.appendChild(f.grp));
    read.textContent = act < 0 ? "rest" : `file ${act + 1}`;
    B.wake();
  }
  function setActive(a) { if (a !== act) { if (act >= 0) files.forEach((f) => g.appendChild(f.grp)); act = a; apply(); } }

  apply();
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { gap = v; apply(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "upload-tray",
  means: "Files hovering over an upload tray: pick one and it drops into the drop zone while the rest close up.",
  rules: [1, 2, 4, 6],
  range: [9, 13, 17],
  mount,
});
