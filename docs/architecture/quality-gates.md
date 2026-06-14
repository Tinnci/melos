# Quality Gates

Date: 2026-06-14

This document maps the Melos quality checks to the seven dimensions we track:
complexity, code volume, comments, error handling, naming, duplication, and
structure.

## Pipeline

Run the stable gate with:

```bash
bun run quality
```

The stable gate runs:

```text
tsgo typecheck
Biome format check
ESLint quality rules
Biome lint
local quality audit
Knip dependency/dead-code hygiene
dependency-cruiser architecture rules
jscpd duplicate detection
Bun tests
```

Knip is now part of the stable gate:

```bash
bun run quality:knip
```

The previous non-blocking baseline has been removed. Dependency and dead-code
hygiene is blocking for the workspace.

## Dimension Mapping

| Dimension | Tooling | Current policy |
| --- | --- | --- |
| Complexity | ESLint `complexity`, `max-depth`, `max-lines-per-function`; `quality-audit` hotspot report | Warn and report |
| Code volume | ESLint `max-lines`; `quality-audit` largest-file report | Warn and report |
| Comments | `quality-audit` approximate comment ratio | Report only |
| Error handling | `tsgo --noEmit`, strict TypeScript, ESLint recommended rules | Hard gate for type errors and lint errors |
| Naming | `@typescript-eslint/naming-convention` | Warn |
| Duplication | `jscpd` with a 3% threshold | Hard gate |
| Structure | `dependency-cruiser` package boundary rules; Knip workspace hygiene | Hard gate |

## Package Boundary Rules

The architecture gate encodes the package ownership described in
`docs/architecture/api-boundaries.md`:

- `@melos/core` is the semantic foundation and must not import other Melos
  packages.
- `@melos/converter`, `@melos/mei`, and `@melos/mnx` are source-format adapters.
  They must not import renderer, player, web, or playground packages.
- `@melos/renderer` consumes core data and must not import source adapters,
  player, web, or playground packages.
- `@melos/player` consumes core data and must not import renderer, source
  adapters, web, or playground packages.
- Library packages must not import `@melos/web`.
- Source files must not import built `dist` output.

## TS7 Native Typecheck

`bun run typecheck` uses `tsgo` from `@typescript/native-preview`.

The root `tsconfig.json` avoids the removed `baseUrl` option and keeps path
aliases in `paths`. The existing Vite application still has its own build
config, but the root quality gate checks the whole workspace with TS7 native.

## Formatting Baseline

Biome owns the repository formatting baseline:

```bash
bun run format
bun run format:check
```

The formatter is enabled for TypeScript, TSX, JSON, JSONC, and root quality
configuration files. Build output, external research snapshots, coverage, and
`node_modules` remain excluded.

## Current Baseline

The main hotspots are large orchestration files, especially renderer SVG
serialization and web editor state. They are intentionally reported first
instead of immediately blocked, because splitting them safely should follow the
existing renderer pipeline plan:

```text
Score -> core timeline -> layout analysis -> render plan -> spacing solver
      -> glyph planner -> collision resolver -> backend
```

The next cleanup batches should target:

- Renderer `GlyphPlanner` extraction from `packages/renderer/src/index.ts`.
- Store command extraction from `packages/web/src/store/scoreStore.ts`.
- Shared score fixture builders for duplicated timeline and spacing tests.
- Typed parser cleanup for MusicXML/MEI adapter code that still relies on
  `any`.
