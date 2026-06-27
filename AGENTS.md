# AGENTS.md

## Cursor Cloud specific instructions

Stitchify is a **frontend-only** Vite + React 19 + TypeScript + Tailwind v4 PWA. There is no
backend, database, or test suite — everything runs in the browser.

### Services

There is a single service: the Vite dev server.

- Run it with `npm run dev` (serves on `http://localhost:5173`). Use `npm run dev -- --host` if you
  need it reachable on the VM's network interface.
- Standard scripts live in `package.json`: `npm run lint`, `npm run build` (runs `tsc -b` then
  `vite build` and generates the PWA service worker), `npm run preview`.

### Non-obvious notes

- `npm run lint` currently reports pre-existing errors in `src/lib/canvasRenderer.ts`,
  `src/lib/emParser.ts`, and `src/lib/patternEngine.ts`. These files are intentionally marked
  `@ts-nocheck` (verbatim ports of the validated vanilla-JS prototype, per `README.md`). Do not
  "fix" them as part of unrelated work — the lint failures are expected.
- The app boots with a default procedural pattern already on the canvas, so no image upload is
  needed to exercise the core renderer / progress tracker. Tap cells on the canvas to mark stitches
  done; the footer completion bar updates live. "New pattern" (image → chart) does require uploading
  an image file.
- Node: `.nvmrc` pins 22.16.0; `engines` requires `>=22.12.0`. The VM's default Node satisfies the
  engines range, so no version switching is required.
