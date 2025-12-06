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
   // console.error("- Error: No slur generated on Event 1");
}

// Test 5: Multi-Voice Example
const mockMusicXMLVoices = `
<score-partwise version="3.1">
   <part-list>
      <score-part id="P1"><part-name>Piano</part-name></score-part>
   </part-list>
   <part id="P1">
      <measure number="1">
         <attributes><divisions>1</divisions></attributes>
         
         <!-- Voice 1: Half Note C -->
         <note>
            <pitch><step>C</step><octave>5</octave></pitch>
            <duration>2</duration>
            <voice>1</voice>
            <type>half</type>
         </note>
         
         <!-- Voice 1: Half Note E -->
         <note>
            <pitch><step>E</step><octave>5</octave></pitch>
            <duration>2</duration>
            <voice>1</voice>
            <type>half</type>
         </note>
         
         <!-- Voice 2: Whole Note C (runs parallel) -->
         <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>4</duration>
            <voice>2</voice>
            <type>whole</type>
         </note>
      </measure>
   </part>
</score-partwise>
`;

console.log("\n(New Test) Converting MusicXML with Multi-Voice...");
const scoreVoices = converter.convert(mockMusicXMLVoices);
const mVoices = scoreVoices.parts[0].measures[0];

console.log(`- Sequences (Voices) count: ${mVoices.sequences.length} (Expected 2)`);

if (mVoices.sequences.length >= 2) {
   const v1 = mVoices.sequences[0].content;
   const v2 = mVoices.sequences[1].content;

   console.log(`- Voice 1 events: ${v1.length} (Expected 2)`);
   console.log(`- Voice 2 events: ${v2.length} (Expected 1)`);

   if (v1.length === 2 && v2.length === 1) {
      console.log("  -> Multi-voice separation CORRECT.");
   } else {
      console.error("  -> Multi-voice separation INCORRECT.");
   }
} else {
   console.error("- Error: Failed to generate multiple sequences.");
}

// Test 6: Lyrics Example
const mockMusicXMLLyrics = `
<score-partwise version="3.1">
   <part-list>
      <score-part id="P1"><part-name>Vocal</part-name></score-part>
   </part-list>
   <part id="P1">
      <measure number="1">
         <attributes><divisions>1</divisions></attributes>
         
         <!-- Note 1: "Hel-" (begin) -->
         <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>quarter</type>
            <lyric number="1" name="Verse 1">
               <syllabic>begin</syllabic>
               <text>Hel</text>
            </lyric>
         </note>
         
         <!-- Note 2: "-lo" (end) -->
         <note>
            <pitch><step>D</step><octave>4</octave></pitch>
            <duration>1</duration>
            <type>quarter</type>
            <lyric number="1">
               <syllabic>end</syllabic>
               <text>lo</text>
            </lyric>
         </note>

         <!-- Note 3: "World" (single) -->
         <note>
            <pitch><step>E</step><octave>4</octave></pitch>
            <duration>2</duration>
            <type>half</type>
            <lyric number="1">
               <syllabic>single</syllabic>
               <text>World</text>
            </lyric>
         </note>
      </measure>
   </part>
</score-partwise>
`;

console.log("\n(New Test) Converting MusicXML with Lyrics...");
const scoreLyrics = converter.convert(mockMusicXMLLyrics);
const mLyrics = scoreLyrics.parts[0].measures[0];
const eventsLyrics = mLyrics.sequences[0].content as any[];

// Validate Global Metadata
if (scoreLyrics.global.lyrics && scoreLyrics.global.lyrics.length > 0) {
   console.log(`- Global Lyric Lines found: ${scoreLyrics.global.lyrics.length} (Expected 1)`);
   console.log(`- Line ID: ${scoreLyrics.global.lyrics[0].id}, Name: ${scoreLyrics.global.lyrics[0].name}`);
} else {
   // console.error("- Error: No global lyric lines generated.");
}

// Validate Event Lyrics
const evL1 = eventsLyrics[0];
if (evL1.lyrics && evL1.lyrics.length > 0) {
   console.log(`- Event 1 Lyric: "${evL1.lyrics[0].text}" (${evL1.lyrics[0].syllabic})`);
   if (evL1.lyrics[0].text === "Hel" && evL1.lyrics[0].syllabic === "begin") {
      console.log("  -> Lyric 1 content CORRECT.");
   } else {
      console.error("  -> Lyric 1 content INCORRECT.");
   }
} else {
   // console.error("- Error: No lyric generated on Event 1");
}

// Test 7: Dynamics (Directions) Example
const mockMusicXMLDynamics = `
<score-partwise version="3.1">
   <part-list>
      <score-part id="P1"><part-name>Music</part-name></score-part>
   </part-list>
   <part id="P1">
      <measure number="1">
         <attributes><divisions>1</divisions></attributes>
         
         <!-- Dynamic 'p' before note -->
         <direction placement="below" default-x="10">
            <direction-type>
               <dynamics><p/></dynamics>
            </direction-type>
            <voice>1</voice>
         </direction>

         <note default-x="20">
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>2</duration>
            <type>half</type>
            <voice>1</voice>
         </note>
         
         <!-- Dynamic 'f' after note -->
         <direction placement="below" default-x="30">
            <direction-type>
               <dynamics><f/></dynamics>
            </direction-type>
            <voice>1</voice>
         </direction>

         <note default-x="40">
            <pitch><step>E</step><octave>4</octave></pitch>
            <duration>2</duration>
            <type>half</type>
            <voice>1</voice>
         </note>
      </measure>
   </part>
</score-partwise>
`;

console.log("\n(New Test) Converting MusicXML with Dynamics (Directions)...");
const scoreDynamics = converter.convert(mockMusicXMLDynamics);
const mDyn = scoreDynamics.parts[0].measures[0];
const seqDynContent = mDyn.sequences[0].content;

console.log(`- Events count: ${seqDynContent.length} (Expected 4: Dynamic, Event, Dynamic, Event)`);

// Check order: p -> Note -> f -> Note
const item0 = seqDynContent[0] as any;
const item1 = seqDynContent[1] as any;
const item2 = seqDynContent[2] as any;
const item3 = seqDynContent[3] as any;

const isType0 = item0.type === 'dynamic' && item0.value === 'p';
const isType1 = item1.notes?.length > 0;
const isType2 = item2.type === 'dynamic' && item2.value === 'f';
const isType3 = item3.notes?.length > 0;

if (isType0 && isType1 && isType2 && isType3) {
   console.log("  -> Dynamics sequence order CORRECT (p -> Note -> f -> Note).");
} else {
   console.error("  -> Dynamics sequence order INCORRECT.");
   console.log("     Found types:",
      item0.type || "event",
      item1.type || "event",
      item2.type || "event",
      item3.type || "event"
   );
}

// Test 8: Wedge (Crescendo/Diminuendo) Example
const mockMusicXMLWedge = `
<score-partwise version="3.1">
   <part-list>
      <score-part id="P1"><part-name>Music</part-name></score-part>
   </part-list>
   <part id="P1">
      <measure number="1">
         <attributes><divisions>2</divisions></attributes>
         
         <!-- Note 1 (Length 2/2 = 1 Quarter) -->
         <note default-x="10">
             <pitch><step>C</step><octave>4</octave></pitch>
             <duration>2</duration>
             <voice>1</voice>
             <type>quarter</type>
         </note>

         <!-- Wedge Start at Beat 2 (After Note 1, Ticks = 2) -->
         <direction placement="below" default-x="20">
            <direction-type>
               <wedge type="crescendo" number="1"/>
            </direction-type>
            <voice>1</voice>
         </direction>

         <!-- Note 2 (Length 2/2 = 1 Quarter) -->
         <note default-x="30">
             <pitch><step>D</step><octave>4</octave></pitch>
             <duration>2</duration>
             <voice>1</voice>
             <type>quarter</type>
         </note>
         
         <!-- Wedge Stop at Beat 3 (After Note 2, Ticks = 4) -->
         <direction placement="below" default-x="40">
            <direction-type>
               <wedge type="stop" number="1"/>
            </direction-type>
            <voice>1</voice>
         </direction>
      </measure>
   </part>
</score-partwise>
`;

console.log("\n(New Test) Converting MusicXML with Wedges (Crescendo)...");
const scoreWedge = converter.convert(mockMusicXMLWedge);
const mWedge = scoreWedge.parts[0].measures[0];

// console.log(JSON.stringify(mWedge.wedges, null, 2));

if (mWedge.wedges && mWedge.wedges.length > 0) {
   const w = mWedge.wedges[0];
   console.log(`- Wedge found: ${w.type}`);

   // Check start position
   // Note 1 duration = 2 ticks. Divisions = 2. Whole Note = 8 ticks.
   // Start position should seem to be after Note 1?
   // Based on our simplified logic: 'start' direction is after note 1 in sorted events ONLY if x > note 1 x.
   // In XML above: Note1 x=10, Direction x=20.
   // Parser Logic: Note 1 handled -> Ticker += 2. direction handled -> Start Position = 2/8 = 1/4?

   // Verify Rhythmic Position [numerator, denominator]
   console.log(`- Start Position: ${w.position.fraction[0]}/${w.position.fraction[1]}`);

   // Check End Position
   if (w.end) {
      console.log(`- End Position: Measure ${w.end.measure}, ${w.end.position.fraction[0]}/${w.end.position.fraction[1]}`);

      if (w.position.fraction[0] === 2 && w.end.position.fraction[0] === 4) {
         console.log("  -> Wedge timing CORRECT (Start at beat 2, End at beat 3).");
      } else {
         console.error("  -> Wedge timing INCORRECT.");
      }
   } else {
      console.error("- Error: Wedge end position not set (active wedge leak?).");
   }
} else {
   console.error("- Error: No wedges generated.");
}

console.log("--- Demo Complete ---");
