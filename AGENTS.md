# Procedural Composer Agent Rules

These rules are strict for v0.1 and future updates.

## Scope Rules

- Keep v0.1 scoped to the approved MVP only.
- Do not add Next.js.
- Do not add non-MVP features (PDF, crop marks, bleed, 3D layers, SVG/text layers, effect graph UI).

## Determinism Rules

- Seed determinism is non-negotiable.
- Always derive component seeds via `hashSeed(project.seed, seedOffset)`.
- Variation must be a pure rebase function of `(variationBaseProject, nextSeed)`.
- Variation may update only:
  - `project.seed`
  - shader uniform values where `randomizable: true` and `min`/`max` are defined
- Variation must never progressively mutate from previously varied values.
- Any randomness in shaders/effects must be seeded by deterministic uniforms.

## Architecture Rules

- Keep modular boundaries:
  - `src/core` for rendering/export/project/rng logic
  - `src/store` for state and deterministic reducers/utilities
  - `src/ui` for presentation + user input wiring
- Avoid giant files. Split files once they exceed practical readability.
- Keep strong TypeScript typing; avoid `any` unless there is no alternative.

## Data Contract Rules

- Treat `Project` schema in `src/core/project/schema.ts` as canonical.
- Validate all loaded project JSON with zod before applying to store.
- Keep `version: "0.1"` semantics stable.
- Preserve snapshot recursion safety (`snapshot.projectState.snapshots = []`).

## Rendering Rules

- Layer composition remains ordered and global post-processing runs once after layers.
- Blend modes mapping must stay explicit and tested.
- Any export path must render at target resolution, never viewport screenshot shortcuts.

## Render Determinism Rule

- Rendering output for identical Project JSON and seed must be identical pixel-for-pixel.
- No use of `Math.random()` inside the rendering pipeline.
- All shader randomness must derive from deterministic seed uniforms.

## Testing Rules

- Maintain deterministic unit tests for PRNG/hash/variation.
- Keep schema validation tests current when model evolves.
- Keep store utility tests for reordering and snapshot behavior.

## Change Discipline

- For schema or seed logic changes, update:
  - implementation
  - tests
  - README (if behavior changes)
- Do not refactor away modular folders into monoliths.
