# Notation Capability Matrix

Date: 2026-06-14

This matrix tracks notation capability status for Melos. It is a product and
test-planning document, not an architecture document. Package boundaries live
in `docs/architecture/api-boundaries.md`.

Status key:

- `Supported`: implemented and covered by tests or direct rendering.
- `Partial`: common cases work, but the model is not complete.
- `Missing`: no first-class implementation yet.
- `Planned`: an API contract exists, but broader adoption is pending.
- `External`: useful only as optional tooling or research reference.

## Capability Status

| Capability | Melos status | Current evidence | Main gap |
| --- | --- | --- | --- |
| Canonical score model | Supported | `@melos/core` schema | Needs broader semantic validation |
| JSON MNX parsing | Supported | `@melos/mnx` parser | Parser is thin wrapper over core schema |
| Basic notes/rests/chords | Supported | core schema, renderer tests, converter tests | More editing commands needed |
| Dotted durations | Supported | core rhythm tests, renderer dot tests | None immediate |
| Tuplets | Partial | converter, core timeline, renderer layout tests | Nested visual brackets and collisions |
| Grace notes | Partial | converter, core timeline, renderer layout tests | Grace beam/slur/layout quality |
| Multiple voices | Partial | converter and renderer tests | Shared voice/timeline UX in web |
| Hidden rests/skips | Partial | converter, renderer, web, and player timeline tests | Needs broader multi-voice editing UX |
| Beams | Partial | converter ground truth, renderer beams | Cross-staff and advanced beam groups |
| Slurs and ties | Partial | converter and renderer curve support | Cross-system/span diagnostics |
| Cross-staff notation | Partial | staff preserved in converter | Layout model still basic |
| Mid-measure clefs | Partial | converter tests | Renderer hard contribution positioning |
| Key/time changes | Partial | converter/global model | Layout positioning and UI editing |
| Repeats/endings | Partial | converter snapshots | Playback navigation |
| Segno/coda/DC/DS | Partial | converter and renderer markers | Playback/navigation model |
| Dynamics | Supported | converter, SMuFL, renderer tests | Collision/placement pass |
| Articulations | Partial | converter and SMuFL tests | Placement/collision pass |
| Pedal markings | Partial | converter and renderer tests | Cross-measure layout quality |
| Ottava lines | Partial | converter and renderer support | Cross-measure layout quality |
| Lyrics | Partial | converter/MEI support | Melisma spans and editing UI |
| Melisma | Missing | M-Tx research note | Needs core semantic span |
| Microtonal accidentals | Missing | SMuFL research note | Glyph resolver and schema coverage |
| Percussion/unpitched | Partial | core schema, converter support | Staff mapping and playback |
| Polymeter | Missing | LilyPond research note | Core timeline and layout diagnostics |
| Horizontal spacing | Planned | `renderer/src/layout.ts` | Real solver not implemented |
| Collision avoidance | Missing | renderer architecture doc | Needs `CollisionResolver` |
| SMuFL glyph mapping | Partial | `renderer/src/smufl.ts` | More glyphs and metrics metadata |
| SVG preview | Supported | `Renderer.render()` | Backend still coupled to planning |
| PDF/export | Partial | web export dependencies | Needs cleaner optional export API |
| External comparison backend | Missing | LilyPond research note | Optional developer-only tool |
| Structured diagnostics | Planned | core timeline, renderer layout, and web rhythm summaries | Converter adoption |

## Priority Gaps

1. Add span modeling for ties, slurs, wedges, ottavas, pedals, and lyrics.
2. Split renderer planning from SVG serialization.
3. Add import diagnostics for MusicXML and MEI ambiguity.
4. Expand SMuFL coverage with glyph metrics and modern accidentals.
5. Add original edge-case fixtures for cross-staff, melisma, polymeter, and
   microtonal notation.

## Regression Fixture Targets

The next fixtures should be original Melos fixtures inspired by real-world
formats and open-source renderer behavior:

- MusicXML `backup`/`forward` voice interleaving.
- Grace notes before/after main notes and inside tuplets.
- Beams over barlines and cross-staff beams.
- Slurs/ties spanning line or system breaks.
- Lyrics with melisma over slurs and beams.
- Mid-measure clef/key/time changes.
- Percussion/unpitched staves.
- Microtonal accidentals.
- Polymeter or local measure-length diagnostics.
