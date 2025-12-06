# Melos Project Roadmap

This document outlines the development roadmap for **Melos**.

## Phase 1: Core Foundation & Converter Maturity (Current Focus)

The goal is to make the `MusicXML -> MNX` conversion robust enough to handle standard music scores, not just simple examples.

- [ ] **Schema Completion** (`@melos/core`)
    - [ ] Complete Zod definitions for all MNX objects (referencing `src/spec/mnx-schema.json`).
    - [ ] Add rigorous types for `Directions` (dynamics, tempo marks, wedges).
    - [ ] Add support for `Layout` definitions (system breaks, page breaks).

- [ ] **Advanced Converter Logic** (`@melos/converter`)
    - [ ] **Voices**: Support multi-voice staves (Polyphony).
    - [ ] **Beams**: Implement logic to translate XML beams to MNX `beam` objects (requires ID tracking).
    - [ ] **Slurs & Ties**: detailed ID mapping for start/end notes.
    - [ ] **Tuplets**: robust handling of nested tuplets and logic for `inner`/`outer` duration.
    - [ ] **Articulations**: Staccato, tenuto, accents, etc.
    - [ ] **Dynamics**: p, f, cresc, dim lines.

- [ ] **Testing Infrastructure**
    - [ ] Set up a snapshot test suite running against all W3C MNX example pairs.
    - [ ] Ensure round-trip integrity where possible.

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
