import { getOrderedTag, orderedElementToObject, type OrderedXmlNode } from "./OrderedXml";

export type XmlToken = {
    _tag: "attributes" | "note" | "direction" | "backup" | "forward";
    _x: number;
    _order: number;
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
    static extract(xmlMeasure: any, orderedMeasure?: OrderedXmlNode[]): XmlToken[] {
        if (orderedMeasure) {
            return this.extractOrdered(orderedMeasure);
        }

        const tokens: XmlToken[] = [];
        let order = 0;

        const attributes = xmlMeasure.attributes
            ? Array.isArray(xmlMeasure.attributes)
                ? xmlMeasure.attributes
                : [xmlMeasure.attributes]
            : [];

        attributes.forEach((a: any) => {
            if (a.clef) {
                tokens.push({
                    ...a,
                    _tag: "attributes",
                    _x: 0,
                    _order: order++,
                });
            }
        });

        // 1. Extract Notes
        const notes = xmlMeasure.note
            ? Array.isArray(xmlMeasure.note)
                ? xmlMeasure.note
                : [xmlMeasure.note]
            : [];

        notes.forEach((n: any) => {
            tokens.push({
                ...n,
                _tag: "note",
                _x: parseFloat(n["@_default-x"] || "0"),
                _order: order++,
            });
        });

        // 2. Extract Directions (Dynamics, wedges, ottavas, pedals)
        const directions = xmlMeasure.direction
            ? Array.isArray(xmlMeasure.direction)
                ? xmlMeasure.direction
                : [xmlMeasure.direction]
            : [];

        directions.forEach((d: any) => {
            if (this.hasRelevantDirectionType(d)) {
                tokens.push({
                    ...d,
                    _tag: "direction",
                    _x: parseFloat(d["@_default-x"] || "0"),
                    _order: order++,
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
            if (a._tag === b._tag) return a._order - b._order;
            return a._tag === "direction" ? -1 : 1;
        });
    }

    private static extractOrdered(orderedMeasure: OrderedXmlNode[]): XmlToken[] {
        const tokens: XmlToken[] = [];
        let order = 0;

        orderedMeasure.forEach((node) => {
            const tag = getOrderedTag(node);
            if (!this.isSupportedTokenTag(tag)) return;

            const value = orderedElementToObject(node);
            if (tag === "direction" && !this.hasRelevantDirectionType(value)) return;
            if (tag === "attributes" && !value.clef) return;

            tokens.push({
                ...value,
                _tag: tag,
                _x: parseFloat(value["@_default-x"] || "0"),
                _order: order++,
            });
        });

        return tokens;
    }

    private static isSupportedTokenTag(tag: string | undefined): tag is XmlToken["_tag"] {
        return (
            tag === "attributes" ||
            tag === "note" ||
            tag === "direction" ||
            tag === "backup" ||
            tag === "forward"
        );
    }

    private static hasRelevantDirectionType(direction: any): boolean {
        const dTypes = Array.isArray(direction["direction-type"])
            ? direction["direction-type"]
            : [direction["direction-type"]];

        return dTypes.some(
            (dt: any) => dt?.dynamics || dt?.wedge || dt?.["octave-shift"] || dt?.pedal,
        );
    }
}
