import { describe, it, expect } from "bun:test";
import { MusicXMLToMNX } from "../src/index";

describe("MusicXMLToMNX Converter", () => {
    const converter = new MusicXMLToMNX();

    // --- Helper for minimal XML wrapper ---
    const wrapMeasure = (content: string, attributes = '<divisions>1</divisions>') => `
    <score-partwise version="3.1">
       <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
       <part id="P1">
          <measure number="1">
             <attributes>${attributes}</attributes>
             ${content}
          </measure>
       </part>
    </score-partwise>`;

    it("should parse simple chords correctly", () => {
        const xml = wrapMeasure(`
         <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>2</duration><type>half</type>
         </note>
         <note>
            <chord/>
            <pitch><step>E</step><octave>4</octave></pitch>
            <duration>2</duration><type>half</type>
         </note>
        `);

        const res = converter.convert(xml);
        const m1 = res.parts[0].measures[0];
        const event = m1.sequences[0].content[0] as any;

        expect(m1.sequences[0].content.length).toBe(1); // One event with chord
        expect(event.notes).toHaveLength(2);
        expect(event.notes[0].pitch.step).toBe("C");
        expect(event.notes[1].pitch.step).toBe("E");
    });

    it("should parse tuplets correctly", () => {
        const xml = wrapMeasure(`
         <!-- Start -->
         <note>
            <pitch><step>D</step><octave>4</octave></pitch>
            <duration>1</duration><type>eighth</type>
            <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
            <notations><tuplet type="start"/></notations>
         </note>
         <!-- Stop -->
         <note>
            <pitch><step>F</step><octave>4</octave></pitch>
            <duration>1</duration><type>eighth</type>
            <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
            <notations><tuplet type="stop"/></notations>
         </note>
        `, '<divisions>3</divisions><time><beats>3</beats><beat-type>4</beat-type></time>');

        const res = converter.convert(xml);
        const content = res.parts[0].measures[0].sequences[0].content;

        // Expect Tuplet Object
        expect((content[0] as any).type).toBe("tuplet");
        expect((content[0] as any).content).toHaveLength(2);
    });

    it("should parse dynamics and sort them by layout", () => {
        const xml = wrapMeasure(`
         <direction placement="below" default-x="10">
            <direction-type><dynamics><p/></dynamics></direction-type>
         </direction>
         <note default-x="20">
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>2</duration><type>half</type>
         </note>
        `);

        const res = converter.convert(xml);
        const content = res.parts[0].measures[0].sequences[0].content;

        expect(content).toHaveLength(2);
        expect((content[0] as any).type).toBe("dynamic");
        expect((content[0] as any).value).toBe("p");
        expect((content[1] as any).notes).toBeDefined();
    });

    it("should parse wedges (hairpins) and calculate rhythmic position", () => {
        const xml = wrapMeasure(`
         <note default-x="10">
             <pitch><step>C</step><octave>4</octave></pitch>
             <duration>2</duration><type>quarter</type>
         </note>
         <direction placement="below" default-x="20">
            <direction-type><wedge type="crescendo" number="1"/></direction-type>
         </direction>
        `, '<divisions>2</divisions>'); // 2 divs/quarter => 8 divs/whole. Note=2 divs.

        const res = converter.convert(xml);
        const measure = res.parts[0].measures[0];

        expect(measure.wedges).toBeDefined();
        expect(measure.wedges).toHaveLength(1);

        const w = measure.wedges![0];
        expect(w.type).toBe("crescendo");
        // Note is 2 ticks. 2/8 = 1/4.
        expect(w.position.fraction).toEqual([2, 8]);
    });

    it("should parse articulations (staccato, accent, fermata)", () => {
        const xml = wrapMeasure(`
         <note>
            <pitch><step>E</step><octave>4</octave></pitch>
            <duration>2</duration><type>half</type>
            <notations>
               <articulations><tenuto/></articulations>
               <fermata type="upright"/>
            </notations>
         </note>
        `);

        const res = converter.convert(xml);
        const event = res.parts[0].measures[0].sequences[0].content[0] as any;

        expect(event.articulations).toBeDefined();
        expect(event.articulations).toContain("tenuto");
        expect(event.articulations).toContain("fermata");
    });

    it("should parse grace notes correctly (without advancing time)", () => {
        const xml = wrapMeasure(`
         <note>
            <grace/>
            <pitch><step>C</step><octave>4</octave></pitch>
            <type>eighth</type>
         </note>
         <note>
            <pitch><step>E</step><octave>4</octave></pitch>
            <duration>4</duration><type>whole</type>
         </note>
        `);

        const res = converter.convert(xml);
        const content = res.parts[0].measures[0].sequences[0].content;

        // 1. Grace Container
        expect((content[0] as any).type).toBe("grace");
        expect((content[0] as any).content).toHaveLength(1);

        // 2. Main Note
        expect((content[1] as any).notes).toBeDefined();
    });

    it("should handle mixed meters and pickup measures correctly", () => {
        // Measure 1: Pickup (1/4 duration in 4/4 time usually, or explicit 1/4)
        // Measure 2: 3/4 Time
        const xml = `
        <score-partwise version="3.1">
           <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
           <part id="P1">
              <!-- Measure 1: Pickup (implicit) -->
              <measure number="1">
                 <attributes>
                    <divisions>1</divisions>
                    <time><beats>4</beats><beat-type>4</beat-type></time>
                 </attributes>
                 <note>
                    <pitch><step>C</step><octave>4</octave></pitch>
                    <duration>1</duration><type>quarter</type>
                 </note>
              </measure>
              
              <!-- Measure 2: Change to 3/4 -->
              <measure number="2">
                 <attributes>
                    <time><beats>3</beats><beat-type>4</beat-type></time>
                 </attributes>
                 <note>
                    <pitch><step>D</step><octave>4</octave></pitch>
                    <duration>3</duration><type>half</type><dot/>
                 </note>
              </measure>
           </part>
        </score-partwise>`;

        const res = converter.convert(xml);
        const globalMs = res.global.measures;

        // Check Global Track for Time Signatures
        expect(globalMs).toHaveLength(2);

        // Measure 1: 4/4
        expect(globalMs[0].time).toBeDefined();
        expect(globalMs[0].time?.count).toBe(4);
        expect(globalMs[0].time?.unit).toBe(4);

        // Measure 2: 3/4
        expect(globalMs[1].time).toBeDefined();
        expect(globalMs[1].time?.count).toBe(3);
        expect(globalMs[1].time?.unit).toBe(4);

        // Validating Content
        const pMeasures = res.parts[0].measures;
        expect(pMeasures).toHaveLength(2);

        const m1Content = pMeasures[0].sequences[0].content;
        const m2Content = pMeasures[1].sequences[0].content;

        // M1: 1 Quarter note (Pickup)
        expect(m1Content).toHaveLength(1);
        expect((m1Content[0] as any).duration.base).toBe("quarter");

        // M2: 1 Dotted Half note (Filling 3/4)
        expect(m2Content).toHaveLength(1);
        expect((m2Content[0] as any).duration.base).toBe("half");
        expect((m2Content[0] as any).duration.dots).toBe(1);
    });
});
