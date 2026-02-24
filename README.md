# Procedural Composer v0.1

Local desktop procedural graphics composer built with Tauri v2, React, TypeScript, Three.js, and Zustand.

## MVP Features

- Single WebGL canvas renderer
- Layer stack with `image` and `shader` layers
- Global ordered effect chain (`threshold`, `grain`)
- Deterministic seed system (`project.seed + seedOffset`)
- Snapshot and Variation actions
- PNG export at target render size (not viewport screenshot)
- Save/load `project.json` with zod schema validation

## Stack

- Desktop shell: Tauri v2 (Rust backend)
- Frontend: Vite + React + TypeScript
- Rendering: Three.js + EffectComposer
- State: Zustand
- Validation: zod
- Tests: Vitest

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

## How To Use v0.1

1. Launch app with `npm run tauri:dev`.
2. In **Layers** panel, add image/shader layers, toggle visibility, and drag to reorder.
3. In **Inspector**, edit layer opacity/blend/seedOffset and shader fragment/uniforms.
4. Use **Randomize Seed** to change only `project.seed`, or **Variation** to:
   - deterministically advance `project.seed`
   - deterministically randomize only shader uniforms marked `randomizable: true` with valid `min`/`max`/`step`
   - rebase from a frozen baseline project (no cumulative drift)
5. Use **Reset Variation** to return to the captured variation baseline.
5. Use **Snapshot** to capture full project state and restore from the snapshot tray.
6. Use **Save** / **Open** for `project.json`.
7. Export PNG from top bar:
   - Preset: Instagram `1080x1350`
   - Custom: set width/height and export.

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

- No PDF export, crop marks, or bleed
- No 3D layers
- No SVG/text layers
- No effect graph editor (ordered list only)
- Shader editor is Monaco fragment-only (no vertex editing yet)
- Snapshot thumbnails are placeholders
