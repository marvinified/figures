/**
 * keycaps: the letter block of a keyboard in its case, three staggered rows
 * and the space bar, F and J with their home-row bumps. The pointer is read
 * on the tops of the keys: the key under it goes all the way down and takes
 * the bright edge, and the keys round it dip a little, less the farther they
 * are, as far as the slider's reach, each on its own spring. At rest F is
 * bright and every key is up.
 */
const {
  Cam, clamp, fit, proj, prism, rings, seg, facing, unproj,
  spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const U = 12, K = 10.4, H = 7.5, DOWN = 5.6, ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"], SHIFT = [0, 3.2, 8];
const KEYS = [];
ROWS.forEach((r, j) => [...r].forEach((ch, i) => KEYS.push({ ch, x0: SHIFT[j] + i * U, y0: j * U, w: K })));
KEYS.push({ ch: "space", x0: 2.5 * U, y0: 3 * U, w: 5 * U + K - U });
const X1 = 10 * U - (U - K), Y1 = 4 * U - (U - K), REST = KEYS.findIndex((k) => k.ch === "F");

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let REACH = value, over = null, lit = -2;

  const C = Cam(45, 0.5, 2.15);
  fit(C, [[-6, -6, -4], [X1 + 6, -6, -4], [X1 + 6, Y1 + 6, -4], [-6, Y1 + 6, -4], [-6, -6, H + 2], [X1 + 6, -6, H + 2]], 200, 164);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  { const [ring, inner] = rings(-6, -6, X1 + 6, Y1 + 6, 4, 1.5); put(solid(g), prism(P, front, ring, inner, -4, 1.5)); }
  const keys = KEYS.map((k, i) => {
    const [ring, inner] = rings(k.x0, k.y0, k.x0 + k.w, k.y0 + K, 2, 1.6);
    return { ...k, i, ring, inner, cx: k.x0 + k.w / 2, cy: k.y0 + K / 2, sp: spring(0, { k: 260, c: 30, eps: 0.01 }), drawn: NaN };
  }).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  for (const k of keys) { k.el = solid(g); if (k.ch === "F" || k.ch === "J") k.bump = mk("path", { class: "nf" }, k.el.g); }

  function draw(k) {
    const z = H - k.sp.x;
    if (z === k.drawn) return;
    k.drawn = z;
    put(k.el, prism(P, front, k.ring, k.inner, 1.5, z));
    if (k.bump) k.bump.setAttribute("d", seg(P(k.cx - 1.8, k.y0 + K - 2.6, z), P(k.cx + 1.8, k.y0 + K - 2.6, z)));
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const k of keys) { if (stepS(k.sp, dt)) m = true; draw(k); }
    return m;
  });
  bag.add(B.unregister);

  /** The key whose resting top holds the pointer, if any. */
  function under([x, y]) {
    const k = keys.find((q) => x >= q.x0 - (U - K) / 2 && x <= q.x0 + q.w + (U - K) / 2 && y >= q.y0 - (U - K) / 2 && y <= q.y0 + K + (U - K) / 2);
    return k ? k.i : -1;
  }

  function retarget() {
    const hitK = over ? under(over) : -1;
    for (const k of keys) {
      if (k.i === hitK) { k.sp.t = DOWN; continue; }
      const d = over ? Math.hypot(clamp(over[0], k.x0, k.x0 + k.w) - over[0], clamp(over[1], k.y0, k.y0 + K) - over[1]) : 1e9;
      k.sp.t = REACH > 0 && hitK >= 0 ? DOWN * 0.55 * Math.max(0, 1 - d / REACH) : 0;
    }
    const b = hitK >= 0 ? hitK : REST;
    if (b !== lit) { lit = b; keys.forEach((k) => k.el.sil.classList.toggle("hi", k.i === b)); }
    read.textContent = hitK < 0 ? "rest" : KEYS[hitK].ch === "space" ? "space" : `key ${KEYS[hitK].ch}`;
    B.wake();
  }

  retarget();
  bag.add(pointer(stage, { move: ([sx, sy]) => { over = unproj(C, sx, sy, H); retarget(); }, leave: () => { over = null; retarget(); } }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { REACH = v; retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "keycaps",
  means: "The letter keys of a keyboard: the key under the pointer goes down, and the keys round it dip a little.",
  rules: [1, 3, 8],
  range: [0, 9, 18],
  mount,
});
