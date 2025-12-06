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
- [x] **Note Rendering**
    - [x] Note head shapes: whole (hollow), half (hollow), quarter+ (filled).
    - [x] Stem direction rules (above/below middle line).
    - [x] Flags for eighth, 16th, 32nd notes.
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

*   **Tech Stack**: Vite, React, TailwindCSS, shadcn/ui.
*   **Editor UI**:
    *   Toolbars, Property Panels (using shadcn/ui).
    *   Score Canvas (using `@melos/renderer`).
    *   Playback Controls (using `@melos/player`).
    *   State Management (syncing Builder state with UI).

Current progress and short-term plan:

- [x] Initialize `packages/web` (Vite + React scaffold, ESLint, TS configs)
- [x] Wire workspace packages (linked local `@melos/core`, `@melos/renderer`, `@melos/player`, `@melos/converter`)
- [x] Basic Studio shell (App.tsx with header/panels and layout)
- [x] Renderer preview + demo `ScoreBuilder` example renders to the canvas
- [x] Basic playback prototype with `AudioPlayer` (Play/Stop, tempo slider)
- [ ] MusicXML importer & conversion pipeline (dropzone + `@melos/converter` integration)
- [ ] Builder -> Editor mutations (property panel to mutate builder state and re-render)
- [ ] Persistent state and undo/redo (local storage and change history)
- [ ] Snapshot & visual regression tests for the full conversion -> render -> play pipeline
- [ ] Accessibility, keyboard navigation and responsive refinements

Immediate next steps (short-term):

1. Add a minimal MusicXML import UI and wire the converter to the renderer preview so the app can validate and display converted MNX live.
2. Add a small shared store (Zustand) that holds the current `Score` and exposes mutation helpers used by property panels.
3. Write a small set of integration snapshot tests for a handful of W3C MNX samples to cover the convert->render flow.

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
- [ ] **PDF Export**: Direct PDF generation from renderer (via canvas/PDF library).
- [ ] **MIDI Export**: Generate MIDI files from MNX data.
- [ ] **MusicXML 4.0 Support**: Update converter for latest MusicXML features.

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
