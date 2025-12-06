# Melos Studio (Phase 5)

`packages/web` hosts the Phase 5 Studio experience that stitches together the builder, renderer, converter, and player packages. The app targets three goals:

1. **Author** MNX data via an opinionated UI backed by the Builder API.
2. **Validate + Convert** MusicXML uploads into MNX with live diagnostics.
3. **Visualize + Play** the score through the SVG renderer and Web Audio player.

---

## Execution Plan

| Track | Focus | Deliverables |
|-------|-------|--------------|
| **Foundation** | Wire the Vite app into the Bun workspace, share TS/ESLint configs, and expose `@melos/*` packages with aliases. | Workspace-aware `package.json`, root-level lint/test integration, shared `tsconfig` references. |
| **Renderer Surface** | Mount the SVG renderer inside a responsive canvas with adaptive layout primitives ready for the editor shell. | Score preview shell, adaptive panes (timeline, inspector), placeholder state synced to Builder outputs. |
| **Conversion Loop** | Accept MusicXML uploads, run them through the converter, surface validation messages, and diff MNX snapshots. | Dropzone + parser service, toast/channel for validation, snapshot viewer. |
| **Playback Layer** | Use `@melos/player` for transport controls, tempo automation, and future metronome/looping. | Play/stop/tempo UI, Web Audio initialization guardrails, hooks for future timeline sync. |
| **Collaboration / Polish** | Add persistence, shareable links, and dark/light aware theming once core loops stabilize. | Sync to storage (file, gist, or local), onboarding tour, QA checklists. |

Milestone cadence (adjust as we learn):

1. **Week 1 – Studio Shell**: Layout, theming, renderer + player mock data hookup.
2. **Week 2 – Conversion Path**: Upload -> Convert -> Render pipeline with validation surfacing.
3. **Week 3 – Editing Primitives**: Builder-backed property panel + score mutations.
4. **Week 4 – Polish & QA**: Snapshot regression tests, accessibility pass, docs.

---

## Local Development

- Install dependencies at the repo root: `bun install`.
- Launch the Studio: `bun --filter web run dev`.
- Run type-check + lint: `bun --filter web run lint`.

The Studio consumes local workspace builds of `@melos/core`, `@melos/renderer`, and `@melos/player`, so make sure those packages compile before running Vite.

---

## Directory Guide

- `src/main.tsx` – Entry that mounts the React app.
- `src/App.tsx` – Studio shell (panels, renderer surface, transport controls).
- `src/assets` – Static art + SVG tokens for the UI.
- `src/styles` (coming soon) – Shared tokens for the editor theme.

Future enhancements will be tracked in `TODO.md` at the repo root.
