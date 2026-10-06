/**
 * token-bars: a language model's next token, eight candidates standing as bars
 * on a plate, each as tall as its probability, and a temperature track along
 * the plate's front. The pointer's place along the track sets the
 * temperature: cold and the likeliest bar towers over the rest, hot and they
 * level out, each bar on its own spring. Only the top k, the slider, keep a
 * share; the rest sink to stubs. At rest the temperature is 1, the likeliest bar bright.
 */
const {
  Cam, clamp, fit, lerp, proj, prism, rings, seg, facing, unproj,
  spring, stepS, mk, pointer, put, register, disposer, solid, flatDot, place,
} = HL;

const LOGITS = [3.1, 2.4, 2, 1.3, 0.9, 0.5, 0.1, -0.4], BW = 9, GAP = 4.2, D = 9, TY = 21, Y1 = 27, TR = [0.3, 2.4], REST = 1;
const X1 = LOGITS.length * (BW + GAP) - GAP;
const tempAt = (x) => lerp(TR[0], TR[1], clamp(x / X1, 0, 1));
const xOf = (t) => ((t - TR[0]) / (TR[1] - TR[0])) * X1;

/** The share each candidate gets at temperature t, among the top k only. */
function shares(t, k) {
  const e = LOGITS.map((l, i) => (i < k ? Math.exp(l / t) : 0)), s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let K = value, temp = REST, over = false;

  const C = Cam(45, 0.5, 2.2);
  fit(C, [[-6, -6, -4], [X1 + 6, -6, -4], [X1 + 6, Y1, -4], [-6, Y1, -4], [0, 0, 95], [BW, D, 95]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  { const [ring, inner] = rings(-6, -6, X1 + 6, Y1, 4, 1.4); put(solid(g), prism(P, front, ring, inner, -4, 0)); }
  const marks = [seg(P(0, TY, 0), P(X1, TY, 0))];
  for (let k = 0; k <= 14; k++) { const x = (X1 * k) / 14, l = k % 7 ? 1.2 : 2.4; marks.push(seg(P(x, TY - l, 0), P(x, TY + l, 0))); }
  LOGITS.forEach((_, i) => { const x = i * (BW + GAP); marks.push(seg(P(x + 1, D + 3, 0), P(x + BW - 1, D + 3, 0))); });
  mk("path", { d: marks.join(""), class: "nf lo" }, g);
  const knob = flatDot(g, C, 1.8, "dot");

  const bars = LOGITS.map((_, i) => {
    const x = i * (BW + GAP), [ring, inner] = rings(x, 0, x + BW, D, 1.6, 0.8);
    return { i, ring, inner, el: solid(g), sp: spring(0, { eps: 0.05 }), drawn: NaN };
  });
  bars[0].el.sil.classList.add("hi");

  function draw(b) {
    const h = Math.max(1, b.sp.x);
    if (h === b.drawn) return;
    b.drawn = h;
    put(b.el, prism(P, front, b.ring, b.inner, 0, h));
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const b of bars) { if (stepS(b.sp, dt)) m = true; draw(b); }
    return m;
  });
  bag.add(B.unregister);

  function retarget() {
    const p = shares(temp, K);
    bars.forEach((b, i) => { b.sp.t = 1 + 92 * p[i]; });
    place(knob, P(xOf(temp), TY, 0));
    read.textContent = over ? `T ${temp.toFixed(1)}` : "rest";
    B.wake();
  }

  bars.forEach((b, i) => { b.sp.x = b.sp.t = 1 + 92 * shares(REST, K)[i]; });
  retarget();
  bag.add(pointer(stage, {
    move: ([sx, sy]) => { const [x, y] = unproj(C, sx, sy, 0); over = x > -20 && x < X1 + 20 && y > -30 && y < Y1 + 20; temp = over ? tempAt(x) : REST; retarget(); },
    leave: () => { over = false; temp = REST; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { K = v; retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "token-bars",
  means: "A model's next-token probabilities: the pointer sets the temperature, and the bars sharpen or level out.",
  rules: [3, 5, 8],
  range: [3, 5, 8],
  mount,
});
