#!/usr/bin/env node
/**
 * Builds the gallery page: every figure of a folder on one page, interactive,
 * in the order of the folder's gallery.json.
 *
 *   node scripts/build-gallery.mjs [folder]          (default: figures)
 *   node scripts/build-gallery.mjs [folder] --check  (check the registry only, write nothing)
 *
 * gallery.json is the registry: one entry per figure, { no, figure, prompt }, where
 * no is the figure's number, given once and never reused; the page is in its order.
 * The script refuses to write the page, and exits 1, when a figure file in the
 * folder is not registered, when an entry names no figure, when a figure is
 * registered twice, or when a figure's React copy (react/<Name>.tsx) is missing
 * or older than its source. It writes <folder>/index.html, which needs nothing else:
 * open it straight from disk.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SKILL = join(homedir(), ".agents/skills/hairline-create");
const { nameOf } = await import(pathToFileURL(join(SKILL, "build.mjs")).href);
const kernel = readFileSync(join(SKILL, "kernel.js"), "utf8").trimEnd();
const REPO = "https://github.com/marvinified/figures";
const GITHUB = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

const args = process.argv.slice(2), check = args.includes("--check");
const dir = resolve(args.find((a) => !a.startsWith("--")) ?? "figures");
const regPath = join(dir, "gallery.json");
if (!existsSync(regPath)) {
  console.error(`gallery: no registry at ${regPath}; create it as a JSON array of { no, figure, prompt }.`);
  process.exit(1);
}

const figures = new Map();
for (const f of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  const src = readFileSync(join(dir, f), "utf8"), name = /\bhairline\s*\(\s*\{/.test(src) && nameOf(src);
  if (name) figures.set(name, { file: f, src });
}

const registry = JSON.parse(readFileSync(regPath, "utf8"));
const problems = [], seen = new Set(), numbers = new Set();
for (const e of registry) {
  if (!Number.isInteger(e.no) || e.no < 1) problems.push(`entry ${JSON.stringify(e)} needs a "no", a whole number from 1`);
  else if (numbers.has(e.no)) problems.push(`number ${e.no} is given twice`);
  numbers.add(e.no);
  if (!e.figure || !e.prompt) problems.push(`entry ${JSON.stringify(e)} needs a "figure" and a "prompt"`);
  else if (seen.has(e.figure)) problems.push(`"${e.figure}" is registered twice`);
  else if (!figures.has(e.figure)) problems.push(`"${e.figure}" is registered but no figure in ${dir} is named that`);
  seen.add(e.figure);
}
for (const [name, { file }] of figures) {
  if (!seen.has(name)) problems.push(`${file} (figure "${name}") is not in gallery.json: add { "no": <next number>, "figure": "${name}", "prompt": "…" } at the end`);
}
const pascal = (s) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());
for (const [name, { file }] of figures) {
  for (const g of [`${name}.gif`, `${name}-dark.gif`]) {
    const at = join(dir, "gif", g);
    if (!existsSync(at) || statSync(at).mtimeMs < statSync(join(dir, file)).mtimeMs) problems.push(`gif/${g} is missing or older than ${file}: run, from the workspace root, node scripts/export-gifs.mjs`);
  }
  const tsx = join(dir, "react", `${pascal(name)}.tsx`);
  if (!existsSync(tsx)) problems.push(`${file} has no React copy at react/${pascal(name)}.tsx: run, from ${dir}, node ../scripts/export-react.mjs --out react`);
  else if (statSync(tsx).mtimeMs < statSync(join(dir, file)).mtimeMs) problems.push(`react/${pascal(name)}.tsx is older than ${file}: run, from ${dir}, node ../scripts/export-react.mjs --out react`);
}
if (problems.length) {
  for (const p of problems) console.error(`gallery: ${p}`);
  process.exit(1);
}
if (check) {
  console.log(`gallery: ok, ${registry.length} figures registered`);
  process.exit(0);
}

registry.sort((a, b) => a.no - b.no);
const num = (n) => String(n).padStart(2, "0");

/* each React copy, stored without the engine it shares with the others; the page puts it back */
const react = {};
for (const e of registry) {
  const file = `${pascal(e.figure)}.tsx`, src = readFileSync(join(dir, "react", file), "utf8");
  react[e.figure] = { file, parts: src.includes(kernel) ? src.split(kernel) : [src] };
}
const json = (v) => JSON.stringify(v).replace(/<\//g, "<\\/").replace(/<!--/g, "<\\!--");

/* runs in the page: the code as HTML, with comments, strings, keywords and numbers marked */
function highlight(code) {
  const html = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|export|from|default|new|typeof|instanceof|of|in|type|interface|extends|class|null|undefined|true|false|this|async|await|try|catch|throw)\b|(\b\d+(?:\.\d+)?\b)/g;
  let out = "", last = 0;
  for (const m of code.matchAll(re)) {
    out += html(code.slice(last, m.index)) + `<span class="${m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : "n"}">${html(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + html(code.slice(last));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/* each figure in its own scope, so their top-level names cannot collide */
const wrap = (src) => `(() => {\n${src.trim().replace(/<\/script/gi, "<\\/script")}\n})();`;

const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true" class="line"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true" class="line"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};

const cards = registry.map((e) => `    <figure data-search="${esc(`${num(e.no)} ${e.figure} ${e.prompt}`.toLowerCase())}">
      <div class="view">
        <div class="stage" data-figure="${esc(e.figure)}"></div>
        <button type="button" class="icon play" data-play="${esc(e.figure)}" aria-label="Play ${esc(e.figure)}" aria-pressed="false">${ICONS.play}</button>
      </div>
      <figcaption><strong><span class="no">${num(e.no)}</span>${esc(e.figure)}</strong>${esc(e.prompt)}</figcaption>
      <div class="exports">
        <button type="button" data-png="${esc(e.figure)}">PNG</button>
        <a data-gif="${esc(e.figure)}" href="gif/${esc(e.figure)}.gif" download target="_blank">GIF</a>
        <button type="button" data-react="${esc(e.figure)}">React</button>
      </div>
    </figure>`).join("\n");


const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Figures</title>
<script>
  /* the theme before first paint: the saved choice, else light */
  document.documentElement.dataset.theme = localStorage.getItem("hl-theme") || "light";
</script>
<style>
  :root { --bg: #fff; --ink: #1a1a1a; --dim: #9a9a9a; --track: #e6e6e6; --soft: #5c5c5c; --str: #4f7a57; --num: #8a6a2f; color-scheme: light; }
  [data-theme="dark"] { --bg: #0a0a0a; --ink: #ededed; --dim: #6f6f6f; --track: #2a2a2a; --soft: #b4b4b4; --str: #9cc3a3; --num: #d6b77a; color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); }
  body { font: 12px/1.45 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  .switching, .switching *, .switching *::before, .switching *::after { transition: none !important; }
  .bar { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 18px; max-width: 1200px; margin: 0 auto; padding: 18px 24px; background: var(--bg); }
  .bar::after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 32px; background: linear-gradient(var(--bg), transparent); pointer-events: none; }
  .bar h1 { flex: 1; margin: 0; font-size: 12px; font-weight: 500; }
  .icon { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--ink); cursor: pointer; }
  .icon:hover { background: var(--track); }
  .icon:focus-visible { outline: 1.5px solid var(--ink); outline-offset: 2px; }
  .icon svg { width: 18px; height: 18px; fill: currentColor; }
  .icon svg.line { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 28px 24px; max-width: 1200px; margin: 0 auto; padding: 8px 24px 64px; }
  figure { margin: 0; }
  .stage { --hairline-plate: var(--bg); }
  .view { position: relative; }
  .play { position: absolute; right: 4px; bottom: 4px; width: 28px; height: 28px; color: var(--dim); }
  .play svg { width: 14px; height: 14px; }
  .play:hover, .play[aria-pressed="true"] { color: var(--ink); }
  .no { margin-right: 7px; color: var(--dim); font: 400 10px/1 ui-monospace, Menlo, monospace; letter-spacing: 0.04em; }
  dialog.code { width: min(920px, calc(100vw - 48px)); height: min(720px, calc(100vh - 48px)); max-width: none; max-height: none; padding: 0; border: 1px solid var(--track); border-radius: 12px; background: var(--bg); color: var(--ink); overflow: hidden; }
  dialog.code { opacity: 0; transform: translateY(10px) scale(0.98); transition: opacity 220ms ease, transform 220ms ease, overlay 220ms allow-discrete, display 220ms allow-discrete; }
  dialog.code[open] { display: flex; flex-direction: column; opacity: 1; transform: none; }
  dialog.code::backdrop { background: rgba(255, 255, 255, 0); backdrop-filter: blur(0); -webkit-backdrop-filter: blur(0); transition: background 220ms ease, backdrop-filter 220ms ease, -webkit-backdrop-filter 220ms ease, overlay 220ms allow-discrete, display 220ms allow-discrete; }
  dialog.code[open]::backdrop { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  [data-theme="dark"] dialog.code[open]::backdrop { background: rgba(0, 0, 0, 0.45); }
  @starting-style {
    dialog.code[open] { opacity: 0; transform: translateY(10px) scale(0.98); }
    dialog.code[open]::backdrop { background: rgba(255, 255, 255, 0); backdrop-filter: blur(0); -webkit-backdrop-filter: blur(0); }
  }
  dialog.code { box-shadow: 0 24px 64px rgba(0, 0, 0, 0.12); }
  .tools { display: flex; align-items: center; gap: 6px; padding: 10px 10px 10px 16px; border-bottom: 1px solid var(--track); color: var(--dim); font: 12px/1.4 ui-monospace, Menlo, monospace; }
  .tools span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tools button { padding: 3px 10px; border: 1px solid var(--track); border-radius: 999px; background: none; color: var(--dim); font: inherit; font-size: 11px; cursor: pointer; }
  .tools button:hover { color: var(--ink); border-color: var(--ink); }
  .tools button:focus-visible { outline: 1.5px solid var(--ink); outline-offset: 2px; }
  .tools .close { display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; font-size: 16px; line-height: 1; }
  .scroll { flex: 1; display: flex; overflow: auto; font: 12px/1.6 ui-monospace, Menlo, monospace; }
  .scroll pre { margin: 0; padding: 12px 0; }
  .gutter { position: sticky; left: 0; padding: 12px 12px 12px 16px !important; min-width: 52px; text-align: right; color: var(--dim); background: var(--bg); user-select: none; opacity: 0.7; }
  .src { padding: 12px 16px 12px 4px !important; color: var(--ink); tab-size: 2; }
  .src .c { color: var(--dim); font-style: italic; }
  .src .s { color: var(--str); }
  .src .n { color: var(--num); }
  .src .k { font-weight: 600; }
  figcaption { padding: 4px 2px 0; color: var(--dim); font-size: 11.5px; }
  figcaption strong { display: block; margin-bottom: 1px; font-weight: 400; color: var(--soft); }
  figure[hidden] { display: none; }
  .exports { display: flex; gap: 6px; padding: 8px 2px 0; }
  .exports > * { padding: 3px 9px; border: 1px solid var(--track); border-radius: 999px; background: none; color: var(--dim); font: inherit; font-size: 10px; line-height: 1.4; text-decoration: none; cursor: pointer; transition: color 120ms, border-color 120ms; }
  .exports > *:hover { color: var(--ink); border-color: var(--ink); }
  .exports > *:focus-visible { outline: 1.5px solid var(--ink); outline-offset: 2px; }
  .search { width: 170px; height: 30px; padding: 0 12px; border: 0; border-radius: 15px; background: var(--track); color: var(--ink); font: inherit; font-size: 12px; outline: none; }
  .search::placeholder { color: var(--dim); }
  .search::-webkit-search-cancel-button { -webkit-appearance: none; }
  .search:focus-visible { outline: 1.5px solid var(--ink); outline-offset: 2px; }
  .empty { grid-column: 1 / -1; padding: 48px 0; text-align: center; color: var(--dim); }
  a.icon { text-decoration: none; }
  footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 24px; max-width: 1200px; margin: 0 auto; padding: 20px 24px 32px; color: var(--dim); font-size: 11.5px; }
  footer a { color: var(--soft); text-decoration: none; }
  footer a:hover { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }
  footer a:focus-visible { outline: 1.5px solid var(--ink); outline-offset: 2px; border-radius: 2px; }
</style>
</head>
<body>
<div class="bar">
  <h1>Figures</h1>
  <input id="search" class="search" type="search" placeholder="Search  /" aria-label="Search figures" autocomplete="off" spellcheck="false">
  <button id="theme" class="icon" type="button" aria-label="Switch to dark mode"></button>
  <a class="icon" href="${REPO}" target="_blank" rel="noopener" aria-label="Source on GitHub">${GITHUB}</a>
</div>
<main>
${cards}
  <p class="empty" id="empty" hidden>No figure matches.</p>
</main>
<footer>
  <span>Built by <a href="https://marvintunjiola.com" target="_blank" rel="noopener">Marvin Tunjiola</a></span>
  <span>Inspired by <a href="https://lucasmarkes.com/lab/hairline" target="_blank" rel="noopener">Hairline</a> by Lucas Markes</span>
</footer>
<dialog class="code" id="code" aria-label="React code">
  <div class="tools">
    <span id="code-file"></span>
    <button type="button" id="code-copy">Copy</button>
    <button type="button" id="code-download">Download</button>
    <button type="button" class="close" id="code-close" aria-label="Close">&times;</button>
  </div>
  <div class="scroll"><pre class="gutter" aria-hidden="true"></pre><pre class="src"><code></code></pre></div>
</dialog>
<script id="hl-kernel">
${kernel}
</script>
<script type="application/json" id="react-src">${json(react)}</script>
<script>
  window.__figures = new Map();
  window.hairline = (figure) => window.__figures.set(figure.name, figure);
</script>
${registry.map((e) => `<script>\n${wrap(figures.get(e.figure).src)}\n</script>`).join("\n")}
<script>
(() => {
  const ICONS = ${JSON.stringify(ICONS)};
  HL.inject(document);

  const cards = [...document.querySelectorAll("[data-figure]")].map((stage, k) => {
    const figure = window.__figures.get(stage.dataset.figure);
    stage.setAttribute("data-hairline", figure.name);
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", figure.means);
    const svg = HL.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, stage);
    const read = { textContent: "" };
    const card = { figure, stage, phase: k * 0.37, hovered: false, handle: figure.mount({ stage, svg, read }, figure.range[1]) };
    stage.addEventListener("pointerenter", (e) => { if (e.isTrusted) card.hovered = true; });
    stage.addEventListener("pointerleave", (e) => { if (e.isTrusted) card.hovered = false; });
    return card;
  });

  /* play: a pointer of our own traces a figure-eight over each drawing, each a little out of step */
  const send = (c, type, x, y) => {
    const r = c.stage.getBoundingClientRect();
    c.stage.dispatchEvent(new PointerEvent(type, { clientX: r.left + (x / 400) * r.width, clientY: r.top + (y / 320) * r.height, pointerType: "mouse", bubbles: false }));
  };
  const PERIOD = 7000;
  let frame = 0;
  function tick(now) {
    let any = false;
    for (const c of cards) {
      if (!c.playing) continue;
      any = true;
      if (c.hovered) continue;
      const t = (now / PERIOD + c.phase) * Math.PI * 2;
      send(c, "pointermove", 200 + 105 * Math.sin(t), 165 + 70 * Math.sin(2 * t));
    }
    frame = any ? requestAnimationFrame(tick) : 0;
  }
  for (const btn of document.querySelectorAll("[data-play]")) {
    const c = cards.find((c) => c.figure.name === btn.dataset.play);
    btn.addEventListener("click", () => {
      c.playing = !c.playing;
      btn.innerHTML = c.playing ? ICONS.pause : ICONS.play;
      btn.setAttribute("aria-label", (c.playing ? "Pause " : "Play ") + c.figure.name);
      btn.setAttribute("aria-pressed", String(c.playing));
      if (c.playing && !frame) frame = requestAnimationFrame(tick);
      if (!c.playing && !c.hovered) send(c, "pointerleave", 0, 0);
    });
  }

  const search = document.getElementById("search"), empty = document.getElementById("empty");
  search.addEventListener("input", () => {
    const words = search.value.toLowerCase().split(" ").filter(Boolean);
    let shown = 0;
    for (const f of document.querySelectorAll("figure[data-search]")) {
      f.hidden = !words.every((w) => f.dataset.search.includes(w));
      if (!f.hidden) shown++;
    }
    empty.hidden = shown > 0;
  });
  addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== search) { e.preventDefault(); search.focus(); }
    else if (e.key === "Escape" && document.activeElement === search) { search.value = ""; search.dispatchEvent(new Event("input")); search.blur(); }
  });

  /* React: the figure's React copy in a modal, to copy or download */
  const highlight = ${highlight};
  const engine = document.getElementById("hl-kernel").textContent.slice(1, -1);
  const sources = JSON.parse(document.getElementById("react-src").textContent);
  const modal = document.getElementById("code"), copy = document.getElementById("code-copy");
  let open = null;
  for (const btn of document.querySelectorAll("[data-react]")) btn.addEventListener("click", () => {
    const src = sources[btn.dataset.react], code = src.parts.join(engine);
    open = { file: src.file, code };
    document.getElementById("code-file").textContent = src.file;
    modal.querySelector(".src code").innerHTML = highlight(code);
    modal.querySelector(".gutter").textContent = code.split("\\n").map((_, i) => i + 1).join("\\n");
    modal.querySelector(".scroll").scrollTo(0, 0);
    copy.textContent = "Copy";
    modal.showModal();
  });
  document.getElementById("code-close").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(open.code); } catch {
      const t = document.createElement("textarea");
      t.value = open.code; modal.append(t); t.select(); document.execCommand("copy"); t.remove();
    }
    copy.textContent = "Copied";
    setTimeout(() => (copy.textContent = "Copy"), 1200);
  });
  document.getElementById("code-download").addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([open.code], { type: "text/plain" }));
    link.download = open.file;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  /* PNG: the drawing as it stands, with the computed paint written onto each shape */
  const PAINT = ["fill", "stroke", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "visibility", "display"];
  function png(card) {
    const live = card.stage.querySelector("svg"), copy = live.cloneNode(true), W = 1600, H = 1280;
    const a = live.querySelectorAll("*"), b = copy.querySelectorAll("*");
    a.forEach((el, i) => {
      const cs = getComputedStyle(el);
      b[i].setAttribute("style", PAINT.map((k) => k + ":" + cs.getPropertyValue(k)).join(";") + ";stroke-width:" + (0.9 * 400) / 638);
    });
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", W);
    copy.setAttribute("height", H);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const g = c.getContext("2d");
      g.fillStyle = getComputedStyle(document.body).backgroundColor;
      g.fillRect(0, 0, W, H);
      g.drawImage(img, 0, 0, W, H);
      c.toBlob((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = card.figure.name + (root.dataset.theme === "dark" ? "-dark" : "") + ".png";
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copy));
  }
  for (const btn of document.querySelectorAll("[data-png]")) {
    const card = cards.find((c) => c.figure.name === btn.dataset.png);
    btn.addEventListener("click", () => png(card));
  }

  const theme = document.getElementById("theme"), root = document.documentElement;
  const paint = () => {
    const dark = root.dataset.theme === "dark";
    for (const a of document.querySelectorAll("[data-gif]")) a.href = "gif/" + a.dataset.gif + (dark ? "-dark" : "") + ".gif";
    theme.innerHTML = dark ? ICONS.sun : ICONS.moon;
    theme.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  };
  theme.addEventListener("click", () => {
    root.classList.add("switching");
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("hl-theme", root.dataset.theme);
    paint();
    getComputedStyle(root).color;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("switching")));
  });
  paint();
})();
</script>
</body>
</html>
`;

writeFileSync(join(dir, "index.html"), page);
console.log(`gallery: ${join(dir, "index.html")}, ${registry.length} figures`);
