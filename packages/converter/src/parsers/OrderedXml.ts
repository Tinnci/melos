const ATTRIBUTES_KEY = ":@";
const TEXT_KEY = "#text";

export type XmlPrimitive = string | number | boolean | null;
export type XmlValue = XmlPrimitive | XmlRecord | XmlValue[] | undefined;
export type XmlRecord = { [key: string]: XmlValue };
export type OrderedXmlNode = XmlRecord;

export function getOrderedTag(node: OrderedXmlNode): string | undefined {
    return Object.keys(node).find((key) => key !== ATTRIBUTES_KEY);
}

export function getOrderedChildren(
    node: OrderedXmlNode | undefined,
    tagName: string,
): OrderedXmlNode[] {
    if (!node) return [];

    const tag = getOrderedTag(node);
    if (!tag) return [];

    const children = node[tag];
    if (!Array.isArray(children)) return [];

    return children.filter(
        (child): child is OrderedXmlNode => isXmlRecord(child) && getOrderedTag(child) === tagName,
    );
}

export function findOrderedRoot(
    nodes: OrderedXmlNode[],
    tagName: string,
): OrderedXmlNode | undefined {
    return nodes.find((node) => getOrderedTag(node) === tagName);
}

export function getOrderedContent(node: OrderedXmlNode | undefined): OrderedXmlNode[] | undefined {
    if (!node) return undefined;

    const tag = getOrderedTag(node);
    if (!tag) return undefined;

    const content = node[tag];
    return Array.isArray(content) ? content.filter(isXmlRecord) : undefined;
}

export function orderedElementToObject(node: OrderedXmlNode): XmlValue {
    const tag = getOrderedTag(node);
    if (!tag) return {};

    const rawAttributes = node[ATTRIBUTES_KEY];
    const attributes = isXmlRecord(rawAttributes) ? rawAttributes : {};
    const value = orderedContentToObject(node[tag]);

    if (isXmlRecord(value)) {
        return { ...value, ...attributes };
    }

    if (Object.keys(attributes).length > 0) {
        return { [TEXT_KEY]: value, ...attributes };
    }

    return value;
}

function orderedContentToObject(content: XmlValue): XmlValue {
    if (!Array.isArray(content) || content.length === 0) {
        return {};
    }

    const result: XmlRecord = {};
    const textValues: string[] = [];
    let hasElementChildren = false;

    content.forEach((child) => {
        if (!isXmlRecord(child)) return;

        const childTag = getOrderedTag(child);
        if (!childTag) return;

        if (childTag === TEXT_KEY) {
            const text = stringifyXmlText(child[TEXT_KEY]);
            if (text !== undefined) {
                textValues.push(text);
            }
            return;
        }

        hasElementChildren = true;
        appendValue(result, childTag, orderedElementToObject(child));
    });

    if (!hasElementChildren) {
        return textValues.length <= 1 ? textValues[0] : textValues.join("");
    }

    if (textValues.length > 0) {
        result[TEXT_KEY] = textValues.join("");
    }

    return result;
}

function appendValue(target: XmlRecord, key: string, value: XmlValue) {
    const existing = target[key];

    if (existing === undefined) {
        target[key] = value;
    } else if (Array.isArray(existing)) {
        existing.push(value);
    } else {
        target[key] = [existing, value];
    }
}

export function isXmlRecord(value: unknown): value is XmlRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function xmlRecords(value: XmlValue): XmlRecord[] {
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    return values.filter(isXmlRecord);
}

export function xmlText(value: XmlValue): string | undefined {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (isXmlRecord(value)) return xmlText(value[TEXT_KEY]);
    return undefined;
}

export function hasXmlValue(value: XmlValue): boolean {
    return value !== undefined;
}

function stringifyXmlText(value: XmlValue): string | undefined {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return undefined;
}
