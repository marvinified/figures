/**
 * newtons-cradle: five steel balls in a row, each hung on two strings from a
 * pair of rails on four posts over a base. The pointer is a finger in the
 * balls' plane: brush a ball and it is pushed aside, swings back, strikes, and
 * the blow runs through the row to send the far ball out. Pressing on a ball
 * lifts it and every ball outside it and lets them go, so that many leave the
 * far end. The slider is how high a press lifts. It slows and stops of itself.
 * The read-out is how many are out; the ball swung furthest is bright.
 */
const {
  Cam, clamp, fit, proj, prism, rings, seg, facing, rad, mk, pointer, put, register, disposer, solid,
} = HL;

const N = 5, R = 5.5, L = 34, H = 50, Y = 10, W = 46, G = 13.7, DAMP = 0.4, TIP = R + 2.5, MAXA = 0.85;
const X = (i) => (i - (N - 1) / 2) * 2 * R;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let LIFT = value, finger = null, lit = -1;
  const a = new Array(N).fill(0), w = new Array(N).fill(0);

  const C = Cam(45, 0.5, 2.25);
  fit(C, [[-W - 4, -Y - 8, -4], [W + 4, Y + 8, -4], [-W, -Y, H + 2], [W, Y, H + 2], [X(0) - L * 0.75, 0, H - L * 0.66], [X(N - 1) + L * 0.75, 0, H - L * 0.66]], 200, 170);
  const P = proj(C), front = facing(C);
  const block = (x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, ring, inner, z0, z1)); };
  const frame = (y) => {
    block(-W - 1.6, y - 1.6, -W + 1.6, y + 1.6, 1.2, 0.5, 0, H);
    block(W - 1.6, y - 1.6, W + 1.6, y + 1.6, 1.2, 0.5, 0, H);
    block(-W - 1.6, y - 1.3, W + 1.6, y + 1.3, 1.2, 0.5, H - 2.4, H);
  };

  const g = mk("g", {}, svg);
  block(-W - 6, -Y - 8, W + 6, Y + 8, 4, 1.4, -4, 0);
  frame(-Y);
  const back = mk("path", { class: "nf lo" }, g);
  const balls = Array.from({ length: N }, (_, i) => ({ i, el: solid(g) }));
  const fore = mk("path", { class: "nf lo" }, g);
  frame(Y);

  /** Ball i's centre at swing angle t, and where its strings meet it. */
  const centre = (i, t) => [X(i) + L * Math.sin(t), 0, H - 2.4 - L * Math.cos(t)];
  const tie = (c, y) => { const d = [0, y - c[1], H - 2.4 - c[2]], m = Math.hypot(...d); return P(c[0] + (d[0] / m) * R, c[1] + (d[1] / m) * R, c[2] + (d[2] / m) * R); };

  let drawn = "";
  function draw() {
    const key = a.map((t) => t.toFixed(4)).join();
    if (key === drawn) return;
    drawn = key;
    let b = "", f = "";
    for (const ball of balls) {
      const c = centre(ball.i, a[ball.i]), [cx, cy] = P(...c), r = R * C.S;
      ball.el.sil.setAttribute("d", `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`);
      ball.el.cr.setAttribute("d", `M${cx - r * 0.6} ${cy - r * 0.15}a${r * 0.62} ${r * 0.62} 0 0 1 ${r * 0.48} ${-r * 0.45}`);
      b += seg(P(X(ball.i), -Y, H - 2.4), tie(c, -Y));
      f += seg(P(X(ball.i), Y, H - 2.4), tie(c, Y));
    }
    back.setAttribute("d", b);
    fore.setAttribute("d", f);
  }

  /** Move ball i along its arc, away from the finger, until it clears it. */
  function push(i, h) {
    const [fx, fz, vx, vz] = finger, at = (t) => centre(i, t), near = (t) => { const c = at(t); return Math.hypot(c[0] - fx, c[2] - fz) < TIP; };
    if (!near(a[i])) return;
    const c = at(a[i]), dir = Math.sign((c[0] - fx) * Math.cos(a[i]) + (c[2] - fz) * Math.sin(a[i])) || Math.sign(c[0] - fx) || 1;
    let t = a[i];
    for (let k = 0; k < 120 && near(t); k++) t += dir * 0.01;
    const carry = (vx * Math.cos(t) + vz * Math.sin(t)) / L;
    w[i] = Math.sign(carry) === dir ? clamp(carry, -4, 4) : 0;
    a[i] = clamp(t, -MAXA, MAXA);
  }

  /** Touching neighbours closing on each other trade speeds, as equal steel balls do; overlap is shared out. */
  function contacts() {
    for (let pass = 0; pass < N; pass++) {
      const up = pass % 2 === 0;
      for (let k = 0; k < N - 1; k++) {
        const i = up ? k : N - 2 - k, j = i + 1;
        if (Math.sin(a[i]) >= Math.sin(a[j]) - 1e-4) {
          if (w[i] > w[j]) { const s = w[i]; w[i] = w[j]; w[j] = s; }
          if (a[i] > a[j]) { const m = (a[i] + a[j]) / 2; a[i] = m; a[j] = m; }
        }
      }
    }
  }

  const B = register(stage, (dt) => {
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < N; i++) { w[i] += h * (-G * Math.sin(a[i]) - DAMP * w[i]); a[i] += h * w[i]; }
      if (finger) for (let i = 0; i < N; i++) push(i, h);
      contacts();
    }
    draw();
    show();
    const still = a.every((t, i) => Math.abs(t) < 0.004 && Math.abs(w[i]) < 0.02);
    if (still) { a.fill(0); w.fill(0); draw(); return false; }
    return true;
  });
  bag.add(B.unregister);

  function show() {
    let k = 0, far = 0;
    a.forEach((t, i) => { if (Math.abs(t) > far + 0.02) { far = Math.abs(t); k = i; } });
    if (k !== lit) { lit = k; balls.forEach((b) => b.el.sil.classList.toggle("hi", b.i === k)); }
    const out = a.filter((t) => Math.abs(t) > 0.06).length;
    read.textContent = out ? `${out} out` : "rest";
  }

  /** The point under the pointer on the plane the balls swing in, as (x, z). */
  function onPlane([sx, sy]) {
    const o = P(0, 0, 0), ex = P(1, 0, 0), ez = P(0, 0, 1);
    const p = ex[0] - o[0], q = ez[0] - o[0], u = ex[1] - o[1], v = ez[1] - o[1], det = p * v - q * u, rx = sx - o[0], ry = sy - o[1];
    return [(rx * v - q * ry) / det, (p * ry - u * rx) / det];
  }

  /** The finger where the pointer is, moving as fast as the pointer has; one that has just arrived is still. */
  let seen = 0;
  function touch(p) {
    const [x, z] = onPlane(p), t = performance.now() / 1000, gap = t - seen;
    seen = t;
    finger = finger && gap > 0 && gap < 0.1 ? [x, z, 0.5 * finger[2] + (0.5 * (x - finger[0])) / gap, 0.5 * finger[3] + (0.5 * (z - finger[1])) / gap] : [x, z, 0, 0];
    B.wake();
  }

  /** A press on a ball lifts it and the balls outside it to the slider's height, at rest, ready to fall. */
  function lift(pt) {
    const [x, z] = onPlane(pt);
    let best = -1, bd = 2 * R;
    for (let i = 0; i < N; i++) { const c = centre(i, a[i]), d = Math.hypot(c[0] - x, c[2] - z); if (d < bd) { bd = d; best = i; } }
    if (best < 0) return;
    const left = best < (N - 1) / 2 || (best === (N - 1) / 2 && x < 0), m = left ? best + 1 : N - best;
    for (let i = 0; i < N; i++) {
      const out = left ? i < m : i >= N - m;
      if (out) { a[i] = left ? -rad(LIFT) : rad(LIFT); w[i] = 0; }
    }
    finger = null;
    B.wake();
  }

  show();
  bag.add(pointer(stage, { move: touch, down: lift, leave: () => { finger = null; B.wake(); } }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { LIFT = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "newtons-cradle",
  means: "A Newton's cradle: knock a ball or lift a few, and the blow runs through the row to send as many out the far end.",
  rules: [3, 5, 7],
  range: [14, 26, 38],
  mount,
});
