# Stitchify

A cross-stitch pattern maker and progress tracker, built as an installable Progressive Web App (PWA).

This is the production app (Vite + React + TypeScript + Tailwind v4), migrated from the original
vanilla-JS prototype. It runs in any modern browser and can be installed to a phone home screen.

## Features

- **Image → pattern conversion** — turn a photo into a DMC cross-stitch chart (K-means color
  quantization, "max colors" limit, optional Floyd–Steinberg dithering, aspect-ratio lock).
- **Pattern canvas** with five view states: solid blocks, symbol + color, chart/print, active-color
  isolate, and zoom/pan. High-performance single-`<canvas>` renderer with viewport culling for very
  large patterns (hundreds of thousands of stitches).
- **Progress tracking** — tap stitches to mark them done (X marks), per-color circles for the
  selected thread, 20-step undo/redo, and a live completion bar.
- **DMC threads library** (456 colors) with search.
- **Stitch calculator** — physical fabric size from stitch count, fabric count, and margins.
- **Legacy eCanvas `.em` import** — a personal utility for opening old eCanvas saves (including their
  completed-stitch layer). Not a marketed feature.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
npm run build    # type-checks, then outputs static site to dist/
npm run preview  # serve the production build locally
```

## App icons

The PWA icons are rasterized from `scripts/icon.svg`:

```bash
node scripts/gen-icons.mjs
```

## Deploy to Cloudflare Pages

The app is a fully static site (`dist/`), so it deploys to any static host. For Cloudflare Pages:

### Option A — Git integration (recommended)

1. Push this `stitchify-web/` folder to a GitHub repo.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `stitchify-web` (if the repo root is the prototype folder)
4. Deploy. Every push to the branch auto-deploys. The `.node-version` file pins Node 22.

### Option B — Direct upload with Wrangler

```bash
npm run build
npx wrangler pages deploy dist --project-name stitchify
```

`public/_redirects` provides the SPA fallback so all routes serve `index.html`.

## Notes

- The big binary `.em` parser (`src/lib/emParser.ts`) and the image engine
  (`src/lib/patternEngine.ts`) are verbatim ports of the validated prototype logic and are marked
  `@ts-nocheck` on purpose; the rest of the app is fully typed.
- Cloud sync / accounts / payments are intentionally **not** included yet — that is a later phase.
  Imported `.em` progress currently lives in the loaded session.
