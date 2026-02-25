# Procedural Composer v0.1

Local desktop procedural graphics composer built with Tauri v2, React, TypeScript, Three.js, and Zustand.

## MVP Features

- Single WebGL canvas renderer
- Layer stack with `image`, `shader`, and `text` layers
- Global ordered effect chain (`threshold`, `grain`)
- Deterministic seed system (`project.seed + seedOffset`)
- Snapshot and Variation actions
- Layout presets (`activeLayoutId` + camera/canvas framing)
- PNG export at target render size (not viewport screenshot)
- Batch export PNG across selected snapshots and layouts
- Automatic symmetrical bleed on export when layout defines `bleedMM` + `dpi`
- Script tab foundation (layer-local, runtime-only patches)
- Save/load `project.json` with zod schema validation

## Stack

- Desktop shell: Tauri v2 (Rust backend)
- Frontend: Vite + React + TypeScript
- Rendering: Three.js + EffectComposer
- State: Zustand
- Validation: zod
- Tests: Vitest
- Typography runtime: `opentype.js` (vector glyph geometry)

## Setup

1. Install Node.js 20+ and npm.
2. Install Rust using rustup:
   - `curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal`
   - `source "$HOME/.cargo/env"`
3. Install dependencies:
   - `npm install`

## Run

- Frontend only: `npm run dev`
- Desktop app: `npm run tauri:dev`
- Typecheck: `npm run typecheck`
- Tests: `npm run test`
- Production build: `npm run build`

## Determinism Verification

Run a dedicated print/export determinism check:

- Start app: `npm run dev`
- Run verifier: `node scripts/check-print-determinism.mjs`

The script validates:

- A3 export with bleed is identical across repeated runs
- Layout round-trip (`instagramPortrait -> a3_300dpi`) keeps A3 export hash stable
- Batch export (`2 snapshots x A3`) is identical across repeated runs

## How To Use v0.1

1. Launch app with `npm run tauri:dev`.
2. In **Layers** panel, add image/shader layers, toggle visibility, and drag to reorder.
3. In **Inspector**, edit layer opacity/blend/seedOffset and:
   - image source paths
   - text content/font path/font size/letter spacing
   - shader fragment/uniform metadata
   - layer-local script source (apply transactionally)
4. Use **Randomize Seed** to change only `project.seed`, or **Variation** to:
   - deterministically advance `project.seed`
   - deterministically randomize only shader uniforms marked `randomizable: true` with valid `min`/`max`/`step`
   - rebase from a frozen baseline project (no cumulative drift)
5. Use **Layout** to switch the working canvas (camera framing) without mutating layer transforms.
6. Use **Reset Variation** to return to the captured variation baseline.
7. Use **Snapshot** to capture full project state and restore from the snapshot tray.
8. Use **Save** / **Open** for `project.json`.
9. Export PNG from top bar:
   - Current Layout
   - Preset: Instagram `1080x1350`
   - Preset: Facebook Event `1920x1005`
   - Preset: A3 `3508x4961`
   - Preset: A6 `1748x1240`
   - Custom: set width/height and export.
   - Print layouts with `bleedMM` + `dpi` automatically export with symmetrical bleed expansion.
10. Use **Batch Export** to export selected snapshots across selected common layouts into one folder.
11. In **Script** section, enable script per layer and return runtime patch objects:
   - `return { transform: { y: Math.sin(time) * 12 } };`
   - `return { uniforms: { u_intensity: 0.4 } };`

## Project Layout

- `src/core/engine`: renderer orchestration
- `src/core/layers`: layer runtime implementations
- `src/core/effects`: global effect chain + passes
- `src/core/rng`: deterministic seed/hash helpers
- `src/core/export`: export pipeline and presets
- `src/core/project`: schema/defaults/io
- `src/store`: Zustand state and deterministic state utilities
- `src/ui`: UI panels and canvas host

## Known v0.1 Limits

- No PDF export, crop marks, or CMYK/overprint simulation
- No 3D layers
- No SVG layers
- No effect graph editor (ordered list only)
- Shader editor is Monaco fragment-only (no vertex editing yet)
- Snapshot thumbnails are placeholders
- Script runtime is layer-local only (no cross-layer access) and does not mutate project JSON at runtime
