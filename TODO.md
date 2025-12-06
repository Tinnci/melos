# Melos Project Roadmap

This document outlines the development roadmap for **Melos**.

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
    - [x] **Lyrics**: Full support for歌詞 and Verse metadata.
    - [x] **Articulations**: Staccato, tenuto, accent, strong-accent, staccatissimo, fermata.
    - [x] **Grace Notes**: Proper grouping into grace containers, no time advancement.
    - [x] **Layout Breaks**: System and Page break parsing from `<print>` tags.
    - [x] **Internal Refactoring**: Split `MeasureParser` into `TimeTracker` and `XmlEventStream`.

- [x] **Testing Infrastructure**
    - [x] **Playground**: End-to-end integration tests for all implemented features.
    - [x] **Bun Test Migration**: Automated test suite with proper assertions.
    - [x] **Mixed Meter Test**: Verified handling of pickup measures and time signature changes.
    - [ ] Set up a rigorous snapshot test suite running against all W3C MNX example pairs.

## Phase 2: Semantic Validation (The "Linter")

Unlike XML validation, we need *semantic* validation to ensure musical correctness.

- [ ] **Validator Engine** (`@melos/mnx`)
    - [ ] **Rhythmic Integrity**: Verify that notes in a measure add up to the Time Signature.
    - [ ] **Structure Checks**: Ensure Part ID references in global tracks are valid.
    - [ ] **Pitch Bounds**: Warn on unreasonable pitch values.
    - [ ] **CLI Tool**: Create queryable CLI (`melos check my-score.mnx`).

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
- [ ] **Engraving Rules (Next Steps)**
    - [ ] Beam slope calculations (connect beamed notes).
    - [ ] Slur/Tie curves (Bezier curves).
    - [ ] Clef symbols (using SMuFL font).
    - [ ] Key/Time signature display.
    - [ ] Second interval collision handling in chords.

## Phase 4: Builder API & Editor Tools

Enable programmatic creation of music.

- [ ] **Fluent API**
    - [ ] Create a "Builder" pattern for easy score generation (e.g., `new Score().addPart().addMeasure()...`).
- [ ] **Audio Preview**
    - [ ] Basic oscillator-based playback of MNX data in the browser.

## Backlog / Research

- [ ] **Braille Music Generation**: Research converting semantic MNX data to Music Braille.
- [ ] **MusicXML Export**: `MNX -> MusicXML` (lower priority, but needed for interoperability).

