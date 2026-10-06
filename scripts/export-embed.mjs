#!/usr/bin/env node
/**
 * Exports Hairline figures for embedding, interactive:
 *
 *   node export-embed.mjs [figure.js ...]      (default: every figure in this folder)
 *
 * It writes
 *   export/embed/hairline.js     the engine and a small host: load it once per page
 *   export/embed/<name>.js       one figure each, which registers itself with the host
 *   export/embed/Hairline.jsx    a React component that loads and mounts a figure
 *   export/embed/index.html      a demo page with every figure exported
 *   export/iframe/<name>.html    one self-contained page per figure, for an <iframe>
 *
 * On a page:
 *   <script src="hairline.js"></script>
 *   <script src="enclave.js"></script>
 *   <div data-hairline-figure="enclave"></div>
 *
 * The figure fills its element's width at 5:4. It follows the page's theme (a
 * `.dark` or `[data-theme="dark"]` ancestor, or the color-scheme), or takes
 * its own with data-hairline-theme="light|dark". Colours and the stroke can be
 * set with --hairline-plate, --hairline-hi, --hairline-edge, --hairline-mid,
 * --hairline-lo and --hairline-stroke. data-hairline-intensity="0..1" sets
 * the slider's value; the read-out is sent as a `hairline:read` event.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SKILL = join(homedir(), ".agents/skills/hairline-create");
const { nameOf } = await import(pathToFileURL(join(SKILL, "build.mjs")).href);
const kernel = readFileSync(join(SKILL, "kernel.js"), "utf8").trimEnd();

const given = process.argv.slice(2);
const files = (given.length ? given : readdirSync(".").filter((f) => f.endsWith(".js"))).filter((f) => {
  const src = readFileSync(f, "utf8");
  return /\bhairline\s*\(\s*\{/.test(src) && nameOf(src);
});
if (!files.length) {
  console.error("export-embed: no figures found; pass figure files, e.g. node export-embed.mjs enclave.js");
  process.exit(2);
}

/* the host: what the bench does for one figure, done for any number of elements */
const HOST = `
(() => {
  if (window.hairline && window.hairline.mount) return;
  const figures = new Map(), live = new WeakMap();
  /* intensity 0..1 to the figure's own number: two straight lines that meet at 0.5 */
  const at = ([lo, mid, hi], i) => Math.round((i <= 0.5 ? lo + (i / 0.5) * (mid - lo) : mid + ((i - 0.5) / 0.5) * (hi - mid)) * 1000) / 1000;
  const clamp01 = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Math.min(1, Math.max(0, Number(v))) : d);

  function mount(el, name, opts = {}) {
    if (live.has(el)) live.get(el).destroy();
    const figure = figures.get(name);
    if (!figure) throw new Error("hairline: no figure named " + name + "; load its script first.");
    HL.inject(document);
    el.setAttribute("data-hairline", figure.name);
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", figure.means);
    const svg = HL.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, el);
    let text = "rest";
    const read = {
      get textContent() { return text; },
      set textContent(v) {
        text = v == null ? "" : String(v);
        el.setAttribute("data-hairline-read", text);
        if (opts.onRead) opts.onRead(text);
        el.dispatchEvent(new CustomEvent("hairline:read", { detail: text, bubbles: true }));
      },
    };
    const handle = figure.mount({ stage: el, svg, read }, at(figure.range, clamp01(opts.intensity, 0.5)));
    const api = {
      figure,
      get read() { return text; },
      setIntensity: (i) => handle.set(at(figure.range, clamp01(i, 0.5))),
      destroy() {
        handle.destroy();
        svg.remove();
        el.removeAttribute("data-hairline");
        live.delete(el);
      },
    };
    live.set(el, api);
    return api;
  }

  /* every [data-hairline-figure] whose figure is loaded and that is not mounted yet */
  function scan(root = document) {
    root.querySelectorAll("[data-hairline-figure]").forEach((el) => {
      const name = el.getAttribute("data-hairline-figure");
      if (!live.has(el) && figures.has(name)) mount(el, name, { intensity: el.getAttribute("data-hairline-intensity") });
    });
  }

  const hairline = (figure) => {
    figures.set(figure.name, figure);
    if (document.readyState !== "loading") scan();
    document.dispatchEvent(new CustomEvent("hairline:figure", { detail: figure.name }));
  };
  Object.assign(hairline, { mount, scan, figures, get: (el) => live.get(el) });
  window.hairline = hairline;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => scan());
})();
`;

const REACT = `/**
 * <Hairline figure="enclave" />: a Hairline figure, interactive, in React.
 *
 * It loads \`\${src}/hairline.js\` and \`\${src}/\${figure}.js\` once per page
 * (put export/embed in your public folder and point src at it), mounts the
 * figure into a div, and cleans up on unmount.
 *
 *   figure     the figure's name, e.g. "enclave"
 *   src        where the exported files are served from (default "/hairline")
 *   intensity  the slider, 0..1 (default 0.5)
 *   theme      "light" | "dark" to force one; otherwise the page's
 *   onRead     called with the read-out, e.g. "key", "rest"
 */
import { useEffect, useRef } from "react";

const loading = new Map();
const load = (url) => {
  if (!loading.has(url)) {
    loading.set(url, new Promise((done, fail) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = done;
      s.onerror = () => { loading.delete(url); fail(new Error("hairline: could not load " + url)); };
      document.head.appendChild(s);
    }));
  }
  return loading.get(url);
};

export default function Hairline({ figure, src = "/hairline", intensity = 0.5, theme, onRead, className, style }) {
  const el = useRef(null), api = useRef(null), readRef = useRef(onRead);
  readRef.current = onRead;

  useEffect(() => {
    let gone = false;
    load(src + "/hairline.js")
      .then(() => load(src + "/" + figure + ".js"))
      .then(() => {
        if (gone || !el.current) return;
        api.current = window.hairline.mount(el.current, figure, { intensity, onRead: (t) => readRef.current?.(t) });
      })
      .catch((e) => console.error(e));
    return () => {
      gone = true;
      api.current?.destroy();
      api.current = null;
    };
  }, [figure, src]);

  useEffect(() => { api.current?.setIntensity(intensity); }, [intensity]);

  return <div ref={el} className={className} style={style} data-hairline-theme={theme} />;
}
`;

const wrap = (src) => `(() => {\n${src.trim()}\n})();\n`;
const names = [];
const embed = resolve("export/embed"), frame = resolve("export/iframe");
mkdirSync(embed, { recursive: true });
mkdirSync(frame, { recursive: true });

const engine = `${kernel}\n${HOST}`;
writeFileSync(join(embed, "hairline.js"), engine);
writeFileSync(join(embed, "Hairline.jsx"), REACT);

for (const f of files) {
  const src = readFileSync(f, "utf8"), name = nameOf(src);
  names.push(name);
  writeFileSync(join(embed, `${name}.js`), wrap(src));
  /* the iframe page: the engine, the figure, one element that fills the frame; ?theme= and ?intensity= */
  writeFileSync(join(frame, `${name}.html`), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hairline · ${name}</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; background: transparent; overflow: hidden; }
  [data-hairline-figure] { width: 100%; }
</style>
</head>
<body>
<div data-hairline-figure="${name}"></div>
<script>
${engine}
</script>
<script>
(() => {
  const q = new URLSearchParams(location.search), el = document.querySelector("[data-hairline-figure]");
  if (["light", "dark"].includes(q.get("theme"))) el.setAttribute("data-hairline-theme", q.get("theme"));
  if (q.has("intensity")) el.setAttribute("data-hairline-intensity", q.get("intensity"));
  if (q.has("plate")) el.style.setProperty("--hairline-plate", q.get("plate"));
})();
</script>
<script>
${wrap(src)}</script>
</body>
</html>
`);
}

writeFileSync(join(embed, "index.html"), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hairline figures</title>
<style>
  :root { color-scheme: light dark; font: 13px/1.5 ui-monospace, Menlo, monospace; }
  body { margin: 32px auto; max-width: 1100px; padding: 0 20px; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
  figure { margin: 0; border: 1px solid #8884; border-radius: 12px; overflow: hidden; }
  figcaption { display: flex; justify-content: space-between; padding: 8px 12px; border-top: 1px solid #8884; }
</style>
</head>
<body>
<main>
${names.map((n) => `  <figure><div data-hairline-figure="${n}"></div><figcaption><span>${n}</span><span data-read="${n}">rest</span></figcaption></figure>`).join("\n")}
</main>
<script src="hairline.js"></script>
${names.map((n) => `<script src="${n}.js"></script>`).join("\n")}
<script>
  document.addEventListener("hairline:read", (e) => {
    const name = e.target.getAttribute("data-hairline-figure");
    document.querySelector('[data-read="' + name + '"]').textContent = e.detail;
  });
</script>
</body>
</html>
`);

console.log(`engine  ${join(embed, "hairline.js")}`);
console.log(`react   ${join(embed, "Hairline.jsx")}`);
console.log(`demo    ${join(embed, "index.html")}`);
console.log(`figures ${names.join(", ")}  ->  export/embed/<name>.js, export/iframe/<name>.html`);
