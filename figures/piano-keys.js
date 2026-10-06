/**
 * piano-keys: a keyboard of ten white keys and their black keys in twos and
 * threes, between two cheek blocks and under a back rail. The pointer picks a
 * key (black keys tested on their resting tops first, then white); that key's
 * major chord goes down as an arpeggio, root first, and the root takes the
 * bright edge. Notes past the top fold down an octave. At rest a C chord is
 * held. The slider is the arpeggio's step, in ms.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, unproj,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const NW = 10, W = 11, L = 58, ZW = 8, BW = 6, BL = 36, ZB = 12.5, DIP = 5.5, TOP = 14;
const WHITE = [0, 2, 4, 5, 7, 9, 11], NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const X1 = NW * W;

/** The keys, each with its semitone: whites along x, blacks over the gaps after C, D, F, G and A. */
function keyboard() {
  const keys = [];
  for (let i = 0; i < NW; i++) keys.push({ s: WHITE[i % 7] + 12 * Math.floor(i / 7), black: false, x0: i * W + 0.6, x1: (i + 1) * W - 0.6, y1: L, z1: ZW });
  for (let i = 0; i < NW - 1; i++) {
    if (![0, 1, 3, 4, 5].includes(i % 7)) continue;
    const xb = (i + 1) * W;
    keys.push({ s: WHITE[i % 7] + 1 + 12 * Math.floor(i / 7), black: true, x0: xb - BW / 2, x1: xb + BW / 2, y1: BL, z0: ZW, z1: ZB });
  }
  return keys;
}

/** The chord on semitone s: root, third, fifth, a note past the top folded down an octave. */
const chord = (s, top) => [s, s + 4, s + 7].map((n) => (n > top ? n - 12 : n));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value, root = -1;

  const C = Cam(45, 0.5, 2.02);
  fit(C, [[-9, -13, -6], [X1 + 9, L + 3, -6], [X1 + 9, -13, -6], [-9, L + 3, -6], [-9, -13, TOP], [X1 + 9, -13, TOP]], 200, 166);
  const P = proj(C), front = facing(C);
  const block = (parent, x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); put(solid(parent), prism(P, front, ring, inner, z0, z1)); };

  const g = mk("g", {}, svg);
  block(g, -9, -13, X1 + 9, L + 3, 4, 1.6, -6, 0);
  block(g, -9, -13, X1 + 9, -1.5, 3, 1.4, 0, TOP);
  block(g, -9, -1.5, -1, L + 3, 2.6, 1.2, 0, ZW + 3);

  const keys = keyboard(), topS = Math.max(...keys.map((k) => k.s));
  keys.forEach((k) => {
    [k.ring, k.inner] = rings(k.x0, 0, k.x1, k.y1, k.black ? 1.3 : 1.5, k.black ? 0.8 : 1);
    k.el = solid(g); k.d = tween(0); k.drawn = NaN;
  });
  block(g, X1 + 1, -1.5, X1 + 9, L + 3, 2.6, 1.2, 0, ZW + 3);
  function draw(k, d) {
    if (d === k.drawn) return;
    k.drawn = d;
    put(k.el, prism(P, front, k.ring, k.inner, k.black ? k.z0 : 0, k.z1 - d));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const k of keys) { draw(k, tval(k.d, now)); if (!tdone(k.d, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  /** Black keys on their resting tops first, as they stand above the whites; then the white keys. */
  function hit([sx, sy]) {
    const [bx, by] = unproj(C, sx, sy, ZB);
    for (const k of keys) if (k.black && bx >= k.x0 - 0.6 && bx <= k.x1 + 0.6 && by >= 0 && by <= BL) return k.s;
    const [x, y] = unproj(C, sx, sy, ZW);
    if (y < -1 || y > L + 2 || x < 0 || x >= X1) return -1;
    return keys[clamp(Math.floor(x / W), 0, NW - 1)].s;
  }

  function play(s) {
    const now = performance.now(), notes = chord(s < 0 ? 0 : s, topS);
    keys.forEach((k) => {
      const at = notes.indexOf(k.s);
      tset(k.d, at < 0 ? 0 : DIP, now, at < 0 ? 0 : at * stag);
      k.el.sil.classList.toggle("hi", k.s === notes[0]);
    });
    read.textContent = s < 0 ? "rest" : `${NAMES[s % 12]} maj`;
    B.wake();
  }
  function setRoot(s) { if (s !== root) { root = s; play(s); } }

  play(-1);
  bag.add(pointer(stage, { move: (p) => setRoot(hit(p)), leave: () => setRoot(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "piano-keys",
  means: "A keyboard: the key under the pointer plays its major chord, the three keys going down one after another.",
  rules: [1, 2, 8, 10],
  range: [0, 70, 140],
  mount,
});
