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

// Test 3: Beams Example
const mockMusicXMLWithBeams = `
<score-partwise version="3.1">
   <part-list>
      <score-part id="P1"><part-name>Music</part-name></score-part>
   </part-list>
   <part id="P1">
      <measure number="1">
         <attributes><divisions>2</divisions></attributes>
         
         <!-- 8th Note Beam Begin -->
         <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>eighth</type>
            <beam number="1">begin</beam>
         </note>
         
         <!-- 8th Note Beam End -->
         <note>
            <pitch><step>D</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>eighth</type>
            <beam number="1">end</beam>
         </note>
      </measure>
   </part>
</score-partwise>
`;

console.log("\n(New Test) Converting MusicXML with Beams...");
const scoreBeams = converter.convert(mockMusicXMLWithBeams);
const measureBeams = scoreBeams.parts[0].measures[0];

console.log(`- Events count: ${measureBeams.sequences[0].content.length}`);
if (measureBeams.beams && measureBeams.beams.length > 0) {
   console.log(`- Beams found: ${measureBeams.beams.length} (Expected 1)`);
   console.log(`- Beam connects ${measureBeams.beams[0].events.length} events (Expected 2)`);
   console.log("Beam JSON:", JSON.stringify(measureBeams.beams[0], null, 2));
} else {
   console.error("- Error: No beams generated.");
}

// Test 4: Slurs & Ties Example
const mockMusicXMLWithSlurs = `
<score-partwise version="3.1">
   <part-list>
      <score-part id="P1"><part-name>Music</part-name></score-part>
   </part-list>
   <part id="P1">
      <measure number="1">
         <attributes><divisions>1</divisions></attributes>
         
         <!-- Note 1: Slur Start -->
         <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>quarter</type>
            <notations>
               <slur type="start" number="1" placement="above"/>
            </notations>
         </note>
         
         <!-- Note 2: Slur Stop -->
         <note>
            <pitch><step>D</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>quarter</type>
            <notations>
               <slur type="stop" number="1"/>
            </notations>
         </note>

         <!-- Note 3: Tie Start -->
         <note>
            <pitch><step>E</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>quarter</type>
            <notations>
               <tied type="start"/>
            </notations>
         </note>
         
         <!-- Note 4: Tie Stop -->
         <note>
            <pitch><step>E</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>quarter</type>
            <notations>
               <tied type="stop"/>
            </notations>
         </note>
      </measure>
   </part>
</score-partwise>
`;

console.log("\n(New Test) Converting MusicXML with Slurs & Ties...");
const scoreSlurs = converter.convert(mockMusicXMLWithSlurs);
const mSlurs = scoreSlurs.parts[0].measures[0];
const eventsSlurs = mSlurs.sequences[0].content as any[];

// Validate Slur (Event 1 -> Event 2)
const ev1 = eventsSlurs[0];
const ev2 = eventsSlurs[1];

if (ev1.slurs && ev1.slurs.length > 0) {
   console.log("- Slur found on Event 1!");
   console.log(`- Slur target: ${ev1.slurs[0].target} (Expected ${ev2.id})`);
   if (ev1.slurs[0].target === ev2.id) {
      console.log("  -> Slur linkage CORRECT.");
   } else {
      console.error("  -> Slur linkage INCORRECT.");
   }
} else {
   console.error("- Error: No slur generated on Event 1");
}

// Validate Tie (Note 3 -> Note 4)
const n3 = eventsSlurs[2].notes[0];
const n4 = eventsSlurs[3].notes[0];

if (n3.ties && n3.ties.length > 0) {
   console.log("- Tie found on Note 3!");
   console.log(`- Tie target: ${n3.ties[0].target} (Expected ${n4.id})`);
   if (n3.ties[0].target === n4.id) {
      console.log("  -> Tie linkage CORRECT.");
   } else {
      console.error("  -> Tie linkage INCORRECT.");
   }
} else {
   console.error("- Error: No tie generated on Note 3");
}

console.log("--- Demo Complete ---");
