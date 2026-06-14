# Melos Project Roadmap

This document outlines the development roadmap for **Melos**.

---

## Phase 1: Core Foundation & Converter Maturity ✅ COMPLETE

The goal is to make the `MusicXML -> MNX` conversion robust enough to handle standard music scores.

- [x] **Schema Completion** (`@melos/core`)
    - [x] Complete Zod definitions for basic MNX objects (Root, Parts, Measures, Sequences, Events).
    - [x] Add types for `Tuplets`, `Beams`, `Slurs`, `Ties`.
    - [x] Add types for `Lyrics` (Global Line & Event Syllables).
    - [x] Add types for `Directions` (Dynamics, Wedges).
    - [x] Add types for `Articulations` (staccato, tenuto, accent, fermata, etc.).
    - [x] Add types for `Layout` definitions (system breaks, page breaks).
    - [x] Add types for `Grace Notes`.

- [x] **Advanced Converter Logic** (`@melos/converter`)
    - [x] **Voices**: Support multi-voice staves (Polyphony) using `VoiceContext`.
    - [x] **Beams**: Implement logic to translate XML beams to MNX `beam` objects.
    - [x] **Slurs & Ties**: Detailed ID mapping for start/end notes using `PartParsingContext`.
    - [x] **Tuplets**: Robust handling of nested tuplets via Stack-based parsing.
    - [x] **Dynamics**: p, f, etc. (Implemented via `Sort-by-Layout` strategy).
    - [x] **Wedges**: Crescendo/Diminuendo lines (Implemented via `TimeTracker` for Rhythmic Positions).
    - [x] **Lyrics**: Full support for 歌詞 and Verse metadata.
    - [x] **Articulations**: Staccato, tenuto, accent, strong-accent, staccatissimo, fermata.
    - [x] **Grace Notes**: Proper grouping into grace containers, no time advancement.
    - [x] **Layout Breaks**: System and Page break parsing from `<print>` tags.
    - [x] **Internal Refactoring**: Split `MeasureParser` into `TimeTracker` and `XmlEventStream`.

- [x] **Testing Infrastructure**
    - [x] **Playground**: End-to-end integration tests for all implemented features.
    - [x] **Bun Test Migration**: Automated test suite with proper assertions.
    - [x] **Mixed Meter Test**: Verified handling of pickup measures and time signature changes.
    - [x] Set up a rigorous snapshot test suite running against all W3C MNX example pairs.

---

## Phase 2: Semantic Validation (The "Linter") ✅ COMPLETE

Unlike XML validation, we need *semantic* validation to ensure musical correctness.

- [ ] **Validator Engine** (`@melos/mnx`)
    - [x] **Rhythmic Integrity**: Verify that notes in a measure add up to the Time Signature.
    - [x] **Structure Checks**: Ensure Part ID references in global tracks are valid.
    - [x] **Pitch Bounds**: Warn on unreasonable pitch values.
    - [x] **CLI Tool**: Create queryable CLI (`melos check my-score.mnx`).

---

## Phase 3: Web Renderer (The "Visualizer") ✅ MVP COMPLETE

Fill the gap of a native MNX renderer.

- [x] **Initialize `@melos/renderer`**
    - [x] Set up SVG rendering engine.
- [x] **Basic Layout**
    - [x] Render multi-system staves with notes.
    - [x] Dynamic measure width calculation.
    - [x] Automatic System Wrapping (Reflow) when content exceeds page width.
    - [x] Dynamic SVG dimensions.
    - [x] Render multiple sequences/layers per measure for MusicXML voices and MEI layers.
- [x] **Note Rendering**
    - [x] Note head shapes: whole (hollow), half (hollow), quarter+ (filled).
    - [x] Stem direction rules (above/below middle line).
    - [x] Flags for eighth, 16th, 32nd notes.
    - [x] Augmentation dots for dotted notes and rests.
    - [x] Ledger lines for notes outside staff.
    - [x] Chord rendering with shared stems.
    - [x] Rest symbols (whole, half, quarter, eighth).
    - [x] Grace notes (scaled down).
- [x] **Engraving Rules** ✅ COMPLETE
    - [x] Beam slope calculations (connect beamed notes).
    - [x] Slur/Tie curves (Bezier curves).
    - [x] Clef symbols (G-Clef implemented via Bravura SVG path extraction).
    - [x] Key/Time signature display.
    - [x] Second interval collision handling in chords.

- [x] **SMuFL Integration** ✅ COMPLETE
    - [x] Load Bravura locally in the Studio without remote font dependencies.
    - [x] Add a local SMuFL glyph registry for clefs, accidentals, noteheads, rests, dynamics, articulations, jumps, and pedal markings.
    - [x] Render MusicXML edge cases that often fail in MusicXML-only pipelines: double accidentals, colored noteheads, notehead aliases, custom dynamics, fermatas, and piano pedal lines.
    - [x] Use rhythmic positions for pedal bracket endpoints instead of stretching lines to the full measure.
    - [x] Add a Studio fixture URL for real-world visual checks: `?fixture=smufl-edge-cases`.

---

## Phase 4: Builder API & Editor Tools ✅ COMPLETE

Enable programmatic creation of music.

- [x] **Fluent API**
    - [x] Create a "Builder" pattern for easy score generation (`ScoreBuilder`, `PartBuilder`, etc.).
- [x] **Audio Preview**
    - [x] Basic oscillator-based playback of MNX data in the browser (`@melos/player` using Web Audio API).

---

## Phase 5: Web Editor Integration (The "Studio") 🚧 IN PROGRESS
Integrate all packages into a comprehensive Web Editor to allow users to Create, Edit, and Play scores interactively.

*   **Tech Stack**: Vite, React, Vanilla CSS (Design System), Zustand.
*   **Editor UI**:
    *   DAW-style three-column layout (Sidebar / Canvas / Properties).
    *   Score Canvas (using `@melos/renderer`).
    *   Transport Bar with Playback Controls (using `@melos/player`).
    *   State Management (Zustand store syncing Score with UI).

Current progress and short-term plan:

- [x] Initialize `packages/web` (Vite + React scaffold, ESLint, TS configs)
- [x] Wire workspace packages (linked local `@melos/core`, `@melos/renderer`, `@melos/player`, `@melos/converter`)
- [x] Basic Studio shell (App.tsx with header/panels and layout)
- [x] Renderer preview + demo `ScoreBuilder` example renders to the canvas
- [x] Basic playback prototype with `AudioPlayer` (Play/Stop, tempo slider)
- [x] MusicXML importer & conversion pipeline (Dropzone + `@melos/converter` integration)
- [x] MEI importer pipeline for common notation subset (Dropzone + `@melos/mei` integration)
- [x] Zustand store for Score state (`scoreStore.ts`, `transportStore.ts`)
- [x] Component modularization (Dropzone, ScoreCanvas, TransportBar, PropertiesPanel, Sidebar)
- [x] Premium dark theme with glassmorphism design system
- [x] Keyboard shortcuts (Space = Play/Stop, Ctrl+Z = Undo, Ctrl+Shift+Z = Redo)
- [x] localStorage persistence for Score auto-save/restore
- [x] Builder -> Editor mutations (property panel to mutate builder state and re-render)
- [x] TailwindCSS 4.x + shadcn/ui migration
- [x] Editable Time Signature and Key Signature in Properties Panel
- [x] File browse button as alternative to drag-and-drop
- [x] Functional editor palette for inserting notes, rests, dynamics, and measures without adding renderer/editor dependencies.
- [x] Selection inspector for editing duration, dots, pitch, accidentals, noteheads, color, articulations, dynamic text, and deletion.
- [x] Stable event IDs for imported/demo scores so SVG selection maps back to MNX data reliably.
- [x] Preview zoom controls and MNX JSON source view for quick editor/debug workflows.
- [x] Renderer emits interaction metadata for notes, rests, and dynamics.
- [x] Fix undo/redo history to store current snapshots, enabling redo after selection-based mutations.
- [x] Measure hit targets and measure selection for cursor-style editing.
- [x] Active voice selection, add/remove voice controls, and measure/voice-targeted insertion.
- [x] Rhythmic capacity validation for selected voices, including underfull, complete, and overfull editor feedback.
- [ ] Snapshot & visual regression tests for the full conversion -> render -> play pipeline
- [ ] Accessibility, keyboard navigation and responsive refinements

Immediate next steps (short-term):

1. Write snapshot tests for MusicXML/MEI conversion pipeline.
2. Add part creation and instrument metadata editing with sound/MIDI program defaults.
3. Add renderer hit targets and inspectors for control-event objects such as wedges, pedals, ottavas, repeats, endings, and MEI control events.
4. Add rhythm-aware insert options for filling rests, splitting notes, and rejecting accidental overfill when strict mode is enabled.
5. Promote preview screenshots for MusicXML, MEI, SMuFL, and editor mutation flows into CI visual regression checks.

Open-source reference notes:

- MuseScore Studio: strong reference for palettes, selection-first editing, and inspector-based property mutation. Melos should copy the interaction model, not the desktop dependency stack.
- Verovio: strong reference for MEI-first semantics and web/headless rendering. Melos should keep MEI import/export isolated in `@melos/mei` and avoid coupling the editor to Verovio.
- OpenSheetMusicDisplay: reference for browser MusicXML import/preview expectations. Melos should preserve import-preview ergonomics while continuing native MNX rendering.
- VexFlow: reference for low-level web engraving APIs. Melos should mine engraving behavior ideas, but keep the current custom renderer/SMuFL path to maximize MNX control.

---

## Phase 6: Missing MNX Standard Features (Gap Analysis)

Features defined in W3C MNX Schema (`mnx-schema.json`) but not yet implemented in Melos.

### 🔴 Critical (High Impact)

- [x] **Repeats, Jumps & Endings** (Navigation)
    - [x] `repeat-start` / `repeat-end`: Repeat barlines.
    - [x] `ending`: Volta brackets (1st/2nd endings).
    - [x] `jump`: D.S. al Fine, D.S. al Coda, etc.
    - [x] `segno`: Segno sign for navigation.
    - [x] `fine`: End of piece marker.
    - [x] `coda`: Coda sign.
    - **Impact**: Without this, scores with repeats must be "unrolled" (expanding file size) or playback order will be incorrect.

- [x] **Ottavas (Octave Shifts)** ✅ IMPLEMENTED
    - [x] `ottava`: 8va, 8vb, 15ma, 15mb octave displacement lines.
    - **Impact**: High-register piano/violin music will have excessive ledger lines, making scores unreadable.

- [x] **Multimeasure Rests** ✅ IMPLEMENTED
    - [x] `multimeasure-rest`: Show "rest for N measures" instead of N separate rests.
    - **Impact**: Essential for professional-looking part extraction (e.g., orchestral parts).

### 🟡 Important (Medium Impact)

- [x] **Tremolos** ✅ IMPLEMENTED
    - [x] `tremolo-single`: Single-note tremolo (bowed tremolo).
    - [x] `multi-note-tremolo`: Alternating between two notes.
    - **Impact**: String and piano literature relies heavily on tremolo notation.

- [x] **Percussion Kit System** ✅ IMPLEMENTED
    - [x] `kit`: Define a percussion kit (drum set).
    - [x] `kit-component`: Map MIDI notes to staff positions.
    - [x] `kit-note`: Unpitched percussion notes.
    - **Impact**: Drum/percussion scores will not convert correctly; notes may be misplaced.

- [x] **Sound/Playback Definitions** ✅ IMPLEMENTED
    - [x] `sound`: MIDI program/instrument assignment.
    - [x] `midi-number` / `midi-program`: Playback sound mapping.
    - **Impact**: Converted MNX files will lose instrument sound information for playback.

### 🟢 Nice-to-Have (Low Impact)

- [ ] **Styling & Appearance**
    - [x] `color`: Support for colored notes/objects (educational scores, analysis).
    - [x] `accidental-display`: Parenthesized accidentals (cautionary/courtesy accidentals).
    - [ ] `staff-symbol`: Custom staff lines (e.g., 1-line percussion staff).

- [ ] **Advanced Barlines**
    - [x] `barline-type`: dotted, dashed, heavy, double, final, tick, short.

- [ ] **Pedaling & Technique**
    - [x] Pedal markings (piano sustain pedal).
    - [ ] String-specific techniques (harmonics, pizzicato indicators).

- [ ] **System Layout Control**
    - [ ] `system-layout`: Explicit system breaking rules.
    - [ ] `staff-distance`: Control spacing between staves.

---

## Backlog / Research

- [ ] **Braille Music Generation**: Research converting semantic MNX data to Music Braille.
- [ ] **MusicXML Export**: `MNX -> MusicXML` (lower priority, but needed for interoperability).
- [ ] **MEI Export**: `MNX -> MEI` for archive/scholarly interoperability.
- [ ] **MEI Metadata & Facsimile**: Preserve `meiHead`, source descriptions, `facsimile/surface/zone`, and editorial annotations.
- [ ] **PDF Export**: Direct PDF generation from renderer (via canvas/PDF library).
- [ ] **MIDI Export**: Generate MIDI files from MNX data.
- [ ] **MusicXML 4.0 Support**: Update converter for latest MusicXML features.
- [ ] **SMuFL Metadata Coverage**: Import more font metadata, anchors, and glyph bounding boxes so renderer spacing can move beyond fixed offsets.
- [ ] **Visual Regression Harness**: Promote the SMuFL edge-case fixture into an automated screenshot comparison test.
- [ ] **MEI Fixture Suite**: Add real-world MEI examples covering multi-staff piano, multiple layers, editorial markup, and control events spanning measures.

---

## Implementation Priority Matrix

| Priority | Feature | Effort | Business Value |
|----------|---------|--------|----------------|
| P0 | Repeats & Endings | High | Critical for playback/engraving |
| P0 | Ottavas | Medium | Critical for piano/orchestral scores |
| P1 | Multimeasure Rests | Low | Essential for part extraction |
| P1 | Tremolos | Medium | Important for classical music |
| P2 | Percussion Kit | High | Required for drum notation |
| P2 | Sound Definitions | Low | Required for playback |
| P3 | Styling (color) | Low | Educational/analysis use |
