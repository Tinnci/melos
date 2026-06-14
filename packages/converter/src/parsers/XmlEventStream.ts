import {
    getOrderedTag,
    isXmlRecord,
    orderedElementToObject,
    xmlRecords,
    type OrderedXmlNode,
    type XmlRecord,
} from "./OrderedXml";

export type XmlTokenTag = "attributes" | "note" | "direction" | "backup" | "forward";

export type XmlToken = XmlRecord & {
    _tag: XmlTokenTag;
    _x: number;
    _order: number;
};

export class XmlEventStream {
    /**
     * Extracts notes and directions from a MusicXML measure object,
     * flattens them into a unified list, and sorts them by visual layout (default-x).
     *
     * @param xmlMeasure The raw parsed MusicXML measure object.
     * @returns A sorted array of XmlToken objects.
     */
    static extract(xmlMeasure: XmlRecord, orderedMeasure?: OrderedXmlNode[]): XmlToken[] {
        if (orderedMeasure) {
            return XmlEventStream.extractOrdered(orderedMeasure);
        }

        const tokens: XmlToken[] = [];
        let order = 0;

        const attributes = xmlRecords(xmlMeasure.attributes);
        attributes.forEach((attribute) => {
            if (attribute.clef) {
                tokens.push({
                    ...attribute,
                    _tag: "attributes",
                    _x: 0,
                    _order: order++,
                });
            }
        });

        // 1. Extract Notes
        const notes = xmlRecords(xmlMeasure.note);
        notes.forEach((note) => {
            tokens.push({
                ...note,
                _tag: "note",
                _x: parseDefaultX(note),
                _order: order++,
            });
        });

        // 2. Extract Directions (Dynamics, wedges, ottavas, pedals)
        const directions = xmlRecords(xmlMeasure.direction);
        directions.forEach((direction) => {
            if (XmlEventStream.hasRelevantDirectionType(direction)) {
                tokens.push({
                    ...direction,
                    _tag: "direction",
                    _x: parseDefaultX(direction),
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
            if (!XmlEventStream.isSupportedTokenTag(tag)) return;

            const value = orderedElementToObject(node);
            if (!isXmlRecord(value)) return;
            if (tag === "direction" && !XmlEventStream.hasRelevantDirectionType(value)) return;
            if (tag === "attributes" && !value.clef) return;

            tokens.push({
                ...value,
                _tag: tag,
                _x: parseDefaultX(value),
                _order: order++,
            });
        });

        return tokens;
    }

    private static isSupportedTokenTag(tag: string | undefined): tag is XmlTokenTag {
        return (
            tag === "attributes" ||
            tag === "note" ||
            tag === "direction" ||
            tag === "backup" ||
            tag === "forward"
        );
    }

    private static hasRelevantDirectionType(direction: XmlRecord): boolean {
        const dTypes = xmlRecords(direction["direction-type"]);
        return dTypes.some((directionType) =>
            Boolean(
                directionType.dynamics ||
                    directionType.wedge ||
                    directionType["octave-shift"] ||
                    directionType.pedal,
            ),
        );
    }
}

function parseDefaultX(value: XmlRecord): number {
    const raw = value["@_default-x"];
    const parsed = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? "0"));
    return Number.isFinite(parsed) ? parsed : 0;
}
