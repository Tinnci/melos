import { MusicXMLToMNX } from "@melos/converter";
import { MnxParser } from "@melos/mnx";

console.log("--- Starting Melos Demo V3 (W3C Aligned) ---");

// 1. Simulate MusicXML Input (Three-note chord example from W3C)
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

// 2. Convert to MNX Score
const converter = new MusicXMLToMNX();
console.log("Converting MusicXML (Chord Example)...");
const score = converter.convert(mockMusicXML);

console.log("Conversion Result Summary:");
// Note: 'global' and 'parts' are now siblings of 'mnx'
console.log(`- Global Measures: ${score.global.measures.length}`);
console.log(`- Parts: ${score.parts.length}`);

// Check specific content
const firstPart = score.parts[0];
const measure1 = firstPart.measures[0];
const seq1 = measure1.sequences[0];
const events = seq1.content;

console.log(`- Measures in Part 1: ${firstPart.measures.length}`);
console.log(`- Events in Measure 1: ${events.length} (Expected 2: 1 chord + 1 rest)`);

// Log the Chord Event
const chordEvent = events[0];
if ('notes' in chordEvent && chordEvent.notes) {
  console.log(`- Notes in first event (Chord): ${chordEvent.notes.length} (Expected 3)`);
  console.log("First Event JSON:", JSON.stringify(chordEvent, null, 2));
}

// 3. Validation via Parser
const jsonString = JSON.stringify(score);
try {
  // We need to update MnxParser to parse the new root structure as well if we haven't already
  // But wait, typical parser just calls Schema.parse(json)
  const parsedScore = MnxParser.parse(jsonString);
  console.log("\nValidation Successful via MnxParser.");
} catch (e) {
  console.error("Validation failed:", e);
}

console.log("--- Demo Complete ---");
