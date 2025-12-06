export type XmlToken = {
    _tag: "note" | "direction";
    _x: number;
    [key: string]: any;
};

export class XmlEventStream {
    /**
     * Extracts notes and directions from a MusicXML measure object,
     * flattens them into a unified list, and sorts them by visual layout (default-x).
     * 
     * @param xmlMeasure The raw parsed MusicXML measure object.
     * @returns A sorted array of XmlToken objects.
     */
    static extract(xmlMeasure: any): XmlToken[] {
        const tokens: XmlToken[] = [];

        // 1. Extract Notes
        const notes = xmlMeasure.note
            ? (Array.isArray(xmlMeasure.note) ? xmlMeasure.note : [xmlMeasure.note])
            : [];

        notes.forEach((n: any) => {
            tokens.push({
                ...n,
                _tag: "note",
                _x: parseFloat(n["@_default-x"] || "0")
            });
        });

        // 2. Extract Directions (Dynamics & Wedges)
        const directions = xmlMeasure.direction
            ? (Array.isArray(xmlMeasure.direction) ? xmlMeasure.direction : [xmlMeasure.direction])
            : [];

        directions.forEach((d: any) => {
            // Flatten direction-type array if needed
            const dTypes = Array.isArray(d["direction-type"]) ? d["direction-type"] : [d["direction-type"]];

            // We care if it has dynamics OR wedge
            // In the future, this can be expanded to include articulations, ornaments, etc.
            const hasRelevantType = dTypes.some((dt: any) => dt.dynamics || dt.wedge);

            if (hasRelevantType) {
                tokens.push({
                    ...d,
                    _tag: "direction",
                    _x: parseFloat(d["@_default-x"] || "0")
                });
            }
        });

        // 3. Sort by X position
        // Strategy: 
        // - Sort primarily by _x (visual order).
        // - If _x is identical, put 'direction' before 'note'. 
        //   Dynamics/Wedges usually serve as preparation or attribute for the following note.
        return tokens.sort((a, b) => {
            const diff = a._x - b._x;
            if (diff !== 0) return diff;
            return a._tag === "direction" ? -1 : 1;
        });
    }
}
