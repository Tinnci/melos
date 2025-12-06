# Melos Project Roadmap

This document outlines the development roadmap for **Melos**.

## Phase 1: Core Foundation & Converter Maturity (Current Focus)

The goal is to make the `MusicXML -> MNX` conversion robust enough to handle standard music scores, not just simple examples.

- [x] **Schema Completion** (`@melos/core`)
    - [x] Complete Zod definitions for basic MNX objects (Root, Parts, Measures, Sequences, Events).
    - [x] Add types for `Tuplets`, `Beams`, `Slurs`, `Ties`.
    - [x] Add types for `Lyrics` (Global Line & Event Syllables).
    - [x] Add types for `Directions` (Dynamics, Wedges).
    - [ ] Add support for `Layout` definitions (system breaks, page breaks).

- [x] **Advanced Converter Logic** (`@melos/converter`)
    - [x] **Voices**: Support multi-voice staves (Polyphony) using `VoiceContext`.
    - [x] **Beams**: Implement logic to translate XML beams to MNX `beam` objects.
    - [x] **Slurs & Ties**: Detailed ID mapping for start/end notes using `PartParsingContext`.
    - [x] **Tuplets**: Robust handling of nested tuplets via Stack-based parsing.
    - [x] **Dynamics**: p, f, etc. (Implemented via `Sort-by-Layout` strategy).
    - [x] **Wedges**: Crescendo/Diminuendo lines (Implemented via `TimeTracker` for Rhythmic Positions).
    - [x] **Lyrics**: Full support for歌詞 and Verse metadata.
    - [x] **Internal Refactoring**: Split `MeasureParser` into `TimeTracker` and `XmlEventStream`.
    - [ ] **Articulations**: Staccato, tenuto, accents, etc.

- [ ] **Testing Infrastructure**
    - [x] **Playground**: End-to-end integration tests for all implemented features (Chords, Voices, Wedges, etc.).
    - [ ] Set up a rigorous snapshot test suite running against all W3C MNX example pairs.

## Phase 2: Semantic Validation (The "Linter")

Unlike XML validation, we need *semantic* validation to ensure musical correctness.

- [ ] **Validator Engine** (`@melos/mnx`)
    - [ ] **Rhythmic Integrity**: Verify that notes in a measure add up to the Time Signature.
    - [ ] **Structure Checks**: Ensure Part ID references in global tracks are valid.
    - [ ] **Pitch Bounds**: Warn on unreasonable pitch values.
    - [ ] **CLI Tool**: Create queryable CLI (`melos check my-score.mnx`).

## Phase 3: Web Renderer (The "Visualizer")

Fill the gap of a native MNX renderer.

- [ ] **Initialize `@melos/renderer`**
    - [ ] Set up a canvas/SVG rendering engine (likely SVG for scalability).
- [ ] **Basic Layout**
    - [ ] Render a single stave with simple notes.
    - [ ] Implement "Reflow" logic: calculate how many measures fit on a line dynamically.
- [ ] **Engraving Rules**
    - [ ] Stem direction rules.
    - [ ] Beam slope calculations.

## Phase 4: Builder API & Editor Tools

Enable programmatic creation of music.

- [ ] **Fluent API**
    - [ ] Create a "Builder" pattern for easy score generation (e.g., `new Score().addPart().addMeasure()...`).
- [ ] **Audio Preview**
    - [ ] Basic oscillator-based playback of MNX data in the browser.

## Backlog / Research

- [ ] **Braille Music Generation**: Research converting semantic MNX data to Music Braille.
- [ ] **MusicXML Export**: `MNX -> MusicXML` (lower priority, but needed for interoperability).
