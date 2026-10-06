#!/usr/bin/env node
/**
 * Keeps the gallery's GIFs current: for every figure of a folder, a light and a
 * dark GIF in <folder>/gif/, made by export-gif.mjs. Only the GIFs that are
 * missing or older than their figure are made again.
 *
 *   node scripts/export-gifs.mjs [folder] [--force]   (default: figures)
 *
 * The pages export-gif builds on the way land in <folder>/build/.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL = join(homedir(), ".agents/skills/hairline-create");
const { nameOf } = await import(pathToFileURL(join(SKILL, "build.mjs")).href);

const args = process.argv.slice(2), force = args.includes("--force");
const dir = resolve(args.find((a) => !a.startsWith("--")) ?? "figures");
const gif = join(dir, "gif"), build = join(dir, "build");
const one = join(dirname(fileURLToPath(import.meta.url)), "export-gif.mjs");
mkdirSync(gif, { recursive: true });
mkdirSync(build, { recursive: true });

const jobs = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  const src = readFileSync(join(dir, f), "utf8"), name = /\bhairline\s*\(\s*\{/.test(src) && nameOf(src);
  if (!name) continue;
  for (const theme of ["light", "dark"]) {
    const out = join(gif, `${name}${theme === "dark" ? "-dark" : ""}.gif`);
    if (force || !existsSync(out) || statSync(out).mtimeMs < statSync(join(dir, f)).mtimeMs) jobs.push({ file: join(dir, f), theme, out });
  }
}

const run = ({ file, theme, out }) => new Promise((done) => {
  const p = spawn(process.execPath, [one, file, "--theme", theme, "--width", "600", "--out", out], { cwd: build, stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  p.stderr.on("data", (d) => (err += d));
  p.on("close", (code) => {
    console.log(code === 0 ? `gif  ${out}` : `gif  failed ${out}\n${err}`);
    done(code === 0);
  });
});

let failed = 0;
const queue = [...jobs];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) if (!(await run(queue.shift()))) failed++;
}));
console.log(`gifs: ${jobs.length - failed} made, ${failed} failed, ${jobs.length ? "" : "all current"}`.trim());
process.exit(failed ? 1 : 0);
