import { MusicXMLToMNX } from "@melos/converter";
import { MnxParser } from "@melos/mnx";

const converter = new MusicXMLToMNX();

console.log("--- Starting Melos Demo V3 (W3C Aligned) ---");

// Test 1: Chord Example
const mockMusicXML = `
<score-partwise version="3.1">
   <part-list>
      <score-part id="P1">
         <part-name>Music</part-name>
      </score-part>
   </part-list>
   <part id="P1">
      <measure number="1">
         <attributes>
            <divisions>1</divisions>
            <key>
               <fifths>0</fifths>
            </key>
            <time>
               <beats>4</beats>
               <beat-type>4</beat-type>
            </time>
            <clef>
               <sign>G</sign>
               <line>2</line>
            </clef>
         </attributes>
         <note>
            <pitch>
               <step>C</step>
               <octave>4</octave>
            </pitch>
            <duration>2</duration>
            <type>half</type>
         </note>
         <note>
            <chord></chord>
            <pitch>
               <step>E</step>
               <octave>4</octave>
            </pitch>
            <duration>2</duration>
            <type>half</type>
         </note>
         <note>
            <chord></chord>
            <pitch>
               <step>G</step>
               <octave>4</octave>
            </pitch>
            <duration>2</duration>
            <type>half</type>
         </note>
         <note>
            <rest></rest>
            <duration>2</duration>
            <type>half</type>
         </note>
      </measure>
   </part>
</score-partwise>
`;

console.log("Converting MusicXML (Chord Example)...");
const score = converter.convert(mockMusicXML);
console.log(`- Events in Measure 1: ${score.parts[0].measures[0].sequences[0].content.length} (Expected 2)`);

// Test 2: Tuplet Example
const mockMusicXMLWithTuplet = `
<score-partwise version="3.1">
   <part-list>
      <score-part id="P1"><part-name>Music</part-name></score-part>
   </part-list>
   <part id="P1">
      <measure number="1">
         <attributes>
            <divisions>3</divisions>
            <time><beats>3</beats><beat-type>4</beat-type></time>
         </attributes>
         
         <!-- Normal Quarter -->
         <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>3</duration>
            <type>quarter</type>
         </note>

         <!-- Triplet Start -->
         <note>
            <pitch><step>D</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>eighth</type>
            <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
            <notations>
               <tuplet type="start"/>
            </notations>
         </note>
         <!-- Triplet Middle -->
         <note>
            <pitch><step>E</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>eighth</type>
            <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
         </note>
         <!-- Triplet End -->
         <note>
            <pitch><step>F</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>eighth</type>
            <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
            <notations>
               <tuplet type="stop"/>
            </notations>
         </note>

         <!-- Normal Quarter -->
         <note>
            <pitch><step>G</step><octave>4</octave></pitch>
            <duration>3</duration>
            <type>quarter</type>
         </note>
      </measure>
   </part>
</score-partwise>
`;

console.log("\n(New Test) Converting MusicXML with Tuplets...");
const scoreTuplet = converter.convert(mockMusicXMLWithTuplet);

const m1 = scoreTuplet.parts[0].measures[0];
const content = m1.sequences[0].content;
console.log(`- Top level elements: ${content.length} (Expected 3: Note, Tuplet, Note)`);

const tupletObj = content[1] as any;
if (tupletObj.type === 'tuplet') {
   console.log(`- Tuplet found! Contains ${tupletObj.content.length} events (Expected 3)`);
} else {
   console.error("- Error: Tuplet structure not generated correctly. Found:");
   console.log(JSON.stringify(content, null, 2));
}

console.log("--- Demo Complete ---");
