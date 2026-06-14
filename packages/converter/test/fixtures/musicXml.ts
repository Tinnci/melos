import * as fs from "fs";
import * as path from "path";

export function musicXmlFixture(filename: string): string {
    return fs.readFileSync(path.join(import.meta.dir, "../data/musicxml", filename), "utf-8");
}

export function wrapMeasure(content: string, attributes = "<divisions>1</divisions>"): string {
    return `
    <score-partwise version="3.1">
       <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
       <part id="P1">
          <measure number="1">
             <attributes>${attributes}</attributes>
             ${content}
          </measure>
       </part>
    </score-partwise>`;
}
