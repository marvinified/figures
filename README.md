# Hairline figures

A library of interactive isometric line figures in the style of
[`@lucasmarkes/hairline`](https://lucasmarkes.com/lab/hairline): rounded solids drawn in a
single stroke, each one answering the pointer. Every figure ships as plain JS, a React
component, and light and dark GIFs.

![The gallery page](docs/gallery.png)

Open `figures/index.html` straight from disk to see them all. Each card has its own play
button and three pills: **PNG** (drawn in the browser from the figure as it stands), **GIF**
and **React** (the component source, with Copy and Download).

## Layout

```
figures/
  <name>.js          figure sources, the only .js files at this level
  gallery.json       the registry: number, name and prompt of every figure
  index.html         the gallery page (generated)
  react/<Name>.tsx   one self-contained React component per figure (generated)
  gif/<name>.gif     light and dark GIFs, <name>-dark.gif (generated)
  build/             scratch output of the checks (git-ignored)
  archive/           retired figures, read by nothing
scripts/             the build and export scripts
docs/gallery.png     the screenshot above
```

The engine (`kernel.js`) is not in this repo. It comes from the `hairline-create` skill
at `~/.agents/skills/hairline-create/`, and every script reads it from there.

## Requirements

- Node 18+
- Chrome (or Playwright's Chromium) for the checks and the GIFs; `playwright-core` is
  installed once into `~/Library/Caches/hairline-look` on first use
- `ffmpeg` for the GIFs

## Adding or changing a figure

1. Write `figures/<name>.js`. The name says what the object is (`bowling-pins`, `coin-stacks`),
   lowercase and hyphenated.
2. Check it from `figures/build/`:
   ```sh
   cd figures/build
   node ~/.agents/skills/hairline-create/look.mjs ../<name>.js --answer x,y,z --edge x,y,z
   ```
3. Register it in `figures/gallery.json`, at the end with the next number:
   ```json
   { "no": 22, "figure": "<name>", "prompt": "One short line saying what the figure is" }
   ```
   A number stays with its figure through renames and is never given to another.
4. Regenerate everything and rebuild the page:
   ```sh
   (cd figures && node ../scripts/export-react.mjs --out react)
   node scripts/export-gifs.mjs          # only stale GIFs are remade
   node scripts/build-gallery.mjs
   node scripts/build-gallery.mjs --check
   ```

`build-gallery.mjs` refuses to write the page if a figure is unregistered, an entry names no
figure, a figure is listed twice, or a React copy or GIF is missing or older than its source.

To retire a figure, move it to `figures/archive/` and delete its registry entry, React copy
and GIFs.

## Using a figure elsewhere

**React.** Copy `figures/react/<Name>.tsx` into your project. It imports only `react`.

```tsx
import { Dominoes } from "@/components/hairline/Dominoes";

<Dominoes intensity={0.5} theme="dark" onRead={(r) => setRead(r)} className="max-w-md" />
```

**Script embed or iframe.** Run from `figures/`; output lands in `figures/export/`, which is
not part of the gallery.

```sh
node ../scripts/export-embed.mjs dominoes.js
```

```html
<script src="/hairline/hairline.js"></script>
<script src="/hairline/dominoes.js"></script>
<div data-hairline-figure="dominoes" data-hairline-intensity="0.5"></div>
```

**One-off GIF** with your own pointer path or theme:

```sh
node scripts/export-gif.mjs figures/<name>.js --theme dark --path "120,140 260,200"
```

A figure fills its width at 5:4, follows the page's theme (a `.dark` or `[data-theme="dark"]`
ancestor, or `color-scheme`), and can be restyled with `--hairline-plate`, `--hairline-hi`,
`--hairline-edge`, `--hairline-mid`, `--hairline-lo` and `--hairline-stroke`.

## Figures

| No. | Figure | What it is |
| --- | --- | --- |
| 1 | rolodex | A rotary card file you flick round, a detent standing the nearest card up |
| 2 | dominoes | An arc of dominoes whose fall you run along the row, the fallen ones lying shingled |
| 3 | voice-bars | A voice drawn as a row of bars that swells wherever you listen |
| 4 | note-grid | Research notes scattered on a desk that fall into a grid near the pointer |
| 5 | device-frames | Device frames in a stand, the one under the pointer standing up |
| 6 | neural-net | A small neural network where the node under the pointer comes out and its signal runs forward |
| 7 | context-window | A context window over a conversation whose messages rise into it, the system prompt always in |
| 8 | block-tower | A stacking-block tower where the layer under the pointer pushes its blocks out |
| 9 | bowling-pins | Ten pins and a ball that follows the pointer, the pins nearest it leaning away |
| 10 | pendant-lamps | Pendant lamps over a table that swing away from the pointer, the nearest one lit |
| 11 | coin-stacks | A portfolio of coin stacks that rebalances toward the one you pick |
| 12 | stepping-stones | Stepping stones across a stream that rise to meet the pointer |
| 14 | cabinets | Three cabinets out of sync: open a drawer on one and it opens on every machine |
| 15 | nearest-pegs | Pegs scattered like embeddings, where the k nearest to the pointer rise |
| 16 | gate | Lanes of work queued behind a single gate, merging in single file |
| 17 | chat-thread | A phone with a chat thread rising off it, each bubble lifting out when picked |
| 18 | platforms | Three platforms at different heights, tied by planks, that level out to the one you pick |
| 19 | switchboard | A switchboard of calls in progress, the picked line's cord pulling up out of the bay |
| 20 | upload-tray | Files hovering over an upload tray, dropping into the drop zone when picked |
| 21 | widget-board | A dashboard of widget tiles, the one under the pointer lifting out of the board |
| 22 | toolbox | A cantilever toolbox that opens into a staircase of trays |
| 23 | piano-keys | A keyboard where the key under the pointer plays its major chord as an arpeggio |
| 24 | solar-panels | A field of solar panels on posts that all tilt to face the pointer as the sun |
| 25 | bookshelf | A bookcase of mixed books, the one under the pointer tipping out toward you |
| 26 | baggage-carousel | Suitcases riding a carousel that slows under the pointer so you can follow one |
| 27 | mailboxes | A bank of mailboxes whose door under the pointer swings open on the post inside |
| 28 | blinds | A venetian blind whose slats open where the pointer is and stay shut further away |
| 29 | swatch-fan | A fan deck of colour strips, the one under the pointer sliding out as the rest part |
| 31 | radio-dial | A portable radio tuned by the pointer, settling on stations as its antenna draws out |
| 32 | balance-scale | A beam balance whose rider follows the pointer along the beam, the beam swinging toward the heavier side |
| 33 | abacus | An abacus where the pointer picks a rod and a count and the beads slide over in turn |
| 34 | token-bars | A model's next-token probabilities that sharpen or level out as the pointer sets the temperature |
| 35 | agent-tools | An agent wired to six tools, the one under the pointer lifting as a call runs out to it |
| 36 | layer-stack | A screen design exploded into layers, the one under the pointer sliding out of the stack |
| 37 | responsive-grid | A responsive grid of cards that stretches and reflows as the pointer drags the page edge |
| 38 | window-stack | A cascade of app windows where the one under the pointer pulls up out of the stack like a file |
| 39 | keycaps | The letter keys of a keyboard, the key under the pointer pressing down |
| 40 | server-rack | A rack of servers, the one under the pointer sliding out with its lights on |
| 41 | marquee-select | Marquee selection on a design canvas, the shapes inside lifting into a box with handles |
| 42 | newtons-cradle | A Newton's cradle where the balls you lift out are matched by as many leaving the far end |
| 43 | metronomes | Metronomes on a rolling board that fall into step when the board is let move |
| 44 | pulley-weights | Two weights on one cord over a pulley, raising one lowers the other by as much |
| 45 | compass-field | A field of compasses whose needles within reach turn to point at the pointer |
| 46 | ripple-pond | Floats on a pond, each lifted in turn by the ripple of a drop at the pointer |

`figures/gallery.json` is the source of truth for this list.
