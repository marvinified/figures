#!/usr/bin/env node
/**
 * Exports a Hairline figure as a looping GIF:
 *
 *   node export-gif.mjs <figure.js | hairline-<name>.html> [options]
 *
 * It builds the page, opens it in Chrome, holds the rest pose, moves the
 * pointer through a path of stops (dwelling at each), leaves, and lets the
 * figure settle back to rest so the GIF loops. Frames come from Chrome's
 * screencast with their real timestamps, so the easing is kept as it played.
 *
 * Options
 *   --theme light|dark   the page's theme (default light)
 *   --width <px>         the GIF's width (default 800)
 *   --fps <n>            frames a second in the GIF (default 30)
 *   --dwell <ms>         time held at each stop (default 1100)
 *   --stops <n>          stops on the default path (default 5)
 *   --path "x,y x,y"     the stops, as viewBox points (400 × 320), instead of the default
 *   --intensity <0..1>   the slider (default: the figure's own)
 *   --plate              keep the plate: the name, the read-out and the frame
 *   --out <file.gif>     where to write it (default export/<name>.gif)
 *
 * The page is laid out at twice the GIF's width, with the strokes scaled to
 * match, and the frames are scaled down: Chrome's screencast only sends CSS
 * pixels, so this is how the lines stay smooth.
 *
 * The default path runs along the drawing's diagonal, from its top left to its
 * bottom right, which is how most isometric figures are laid out.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const SKILL = join(homedir(), ".agents/skills/hairline-create");
const { assemble, nameOf } = await import(pathToFileURL(join(SKILL, "build.mjs")).href);
const { cacheDir } = await import(pathToFileURL(join(SKILL, "look.mjs")).href);

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    theme: { type: "string", default: "light" },
    width: { type: "string", default: "800" },
    fps: { type: "string", default: "30" },
    dwell: { type: "string", default: "1100" },
    stops: { type: "string", default: "5" },
    path: { type: "string" },
    intensity: { type: "string" },
    plate: { type: "boolean", default: false },
    out: { type: "string" },
  },
});
const src = positionals[0];
if (!src) {
  console.error("usage: node export-gif.mjs <figure.js | hairline-<name>.html> [--theme dark] [--path \"x,y x,y\"] [--out file.gif]");
  process.exit(2);
}
if (spawnSync("ffmpeg", ["-version"]).status !== 0) {
  console.error("export-gif: ffmpeg is needed (brew install ffmpeg)");
  process.exit(2);
}

// the page: built from the figure, or taken as it is
let html = resolve(src), name = basename(src).replace(/^hairline-/, "").replace(/\.(js|html)$/, "");
if (src.endsWith(".js")) {
  const figure = readFileSync(src, "utf8");
  name = nameOf(figure) ?? name;
  html = resolve(`hairline-${name}.html`);
  writeFileSync(html, assemble(figure));
}
const out = resolve(opt.out ?? join("export", `${name}${opt.theme === "dark" ? "-dark" : ""}.gif`));
mkdirSync(dirname(out), { recursive: true });

const req = createRequire(join(cacheDir(), "package.json"));
let chromium;
try { ({ chromium } = req("playwright-core")); } catch {
  console.error(`export-gif: playwright-core is not in ${cacheDir()}; run the skill's look.mjs once to install it`);
  process.exit(2);
}
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
// the drawing is laid out at twice the GIF's width; the page's own svg is 638px wide, where a stroke is 0.9
const R = 2 * Number(opt.width), VW = R + 200;
const page = await browser.newPage({ viewport: { width: VW, height: Math.round(R * 0.8) + 600 }, deviceScaleFactor: 1 });
const query = new URLSearchParams({ theme: opt.theme, w: String(R) });
if (opt.intensity) query.set("intensity", opt.intensity);
await page.mouse.move(1, 1);
await page.goto(`${pathToFileURL(html).href}?${query}`);
await page.waitForSelector("#stage svg");
await page.addStyleTag({ content: `#stage { --hairline-stroke: ${(0.9 * R) / 638}; }${opt.plate ? "" : " .tag { visibility: hidden; }"}` });
await page.waitForTimeout(1500);

// where to crop, and the stops in viewBox units
const raw = await page.locator(opt.plate ? ".plate" : "#stage svg").boundingBox(), inset = opt.plate ? 0 : R / 100;
const box = { x: raw.x + inset, y: raw.y + inset, width: raw.width - 2 * inset, height: raw.height - 2 * inset };
const stops = opt.path
  ? opt.path.trim().split(/\s+/).map((p) => p.split(",").map(Number))
  : await page.evaluate((n) => {
    const b = document.querySelector("#stage svg").getBBox(), inset = 0.18, pts = [];
    for (let i = 0; i < n; i++) {
      const t = inset + ((1 - 2 * inset) * i) / Math.max(1, n - 1);
      pts.push([b.x + b.width * t, b.y + b.height * t]);
    }
    return pts;
  }, Number(opt.stops));
const toPage = await page.evaluate((pts) => {
  const svg = document.querySelector("#stage svg"), m = svg.getScreenCTM();
  return pts.map(([x, y]) => { const p = new DOMPoint(x, y).matrixTransform(m); return [p.x, p.y]; });
}, stops);
console.log(`path ${stops.map((p) => p.map(Math.round).join(",")).join(" ")}`);

// record: every painted frame, with when it was painted
const dir = mkdtempSync(join(tmpdir(), "hairline-gif-"));
const frames = [];
const cdp = await page.context().newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const file = join(dir, `f${String(frames.length).padStart(5, "0")}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });

const dwell = Number(opt.dwell);
await page.waitForTimeout(900);
for (const [x, y] of toPage) {
  await page.mouse.move(x, y, { steps: 18 });
  await page.waitForTimeout(dwell);
}
// leave past the far corner, so the way out crosses nothing already visited
const svgBox = await page.locator("#stage svg").boundingBox();
await page.mouse.move(svgBox.x + svgBox.width + 20, svgBox.y + svgBox.height + 20, { steps: 10 });
await page.waitForTimeout(1800);
const end = Date.now() / 1000;
await cdp.send("Page.stopScreencast");
await browser.close();

if (frames.length < 2) {
  console.error("export-gif: no frames were recorded");
  process.exit(1);
}

// each frame lasts until the next one was painted; the last until the end
const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`);
list.push(`file '${frames.at(-1).file}'`);
writeFileSync(join(dir, "list.txt"), `ffconcat version 1.0\n${list.join("\n")}\n`);

// crop the box at the frames' scale, then scale down to the GIF's width
const png = readFileSync(frames[0].file), scale = png.readUInt32BE(16) / VW;
const crop = [box.width, box.height, box.x, box.y].map((v) => Math.round(v * scale)).join(":");
const filter = `fps=${opt.fps},crop=${crop},scale=${opt.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none`;
const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", filter, "-loop", "0", out], { encoding: "utf8" });
rmSync(dir, { recursive: true, force: true });
if (ff.status !== 0) {
  console.error(`export-gif: ffmpeg failed\n${ff.stderr}`);
  process.exit(1);
}
console.log(`${frames.length} frames -> ${out}`);
