const ATTRIBUTES_KEY = ":@";
const TEXT_KEY = "#text";

export type OrderedXmlNode = Record<string, any>;

export function getOrderedTag(node: OrderedXmlNode): string | undefined {
    return Object.keys(node).find(key => key !== ATTRIBUTES_KEY);
}

export function getOrderedChildren(node: OrderedXmlNode | undefined, tagName: string): OrderedXmlNode[] {
    if (!node) return [];

    const tag = getOrderedTag(node);
    if (!tag) return [];

    const children = node[tag];
    if (!Array.isArray(children)) return [];

    return children.filter((child: OrderedXmlNode) => getOrderedTag(child) === tagName);
}

export function findOrderedChild(node: OrderedXmlNode | undefined, tagName: string): OrderedXmlNode | undefined {
    return getOrderedChildren(node, tagName)[0];
}

export function findOrderedRoot(nodes: OrderedXmlNode[], tagName: string): OrderedXmlNode | undefined {
    return nodes.find(node => getOrderedTag(node) === tagName);
}

export function getOrderedContent(node: OrderedXmlNode | undefined): OrderedXmlNode[] | undefined {
    if (!node) return undefined;

    const tag = getOrderedTag(node);
    if (!tag) return undefined;

    const content = node[tag];
    return Array.isArray(content) ? content : undefined;
}

export function orderedElementToObject(node: OrderedXmlNode): any {
    const tag = getOrderedTag(node);
    if (!tag) return {};

    const attributes = node[ATTRIBUTES_KEY] || {};
    const value = orderedContentToObject(node[tag]);

    if (isRecord(value)) {
        return { ...value, ...attributes };
    }

    if (Object.keys(attributes).length > 0) {
        return { [TEXT_KEY]: value, ...attributes };
    }

    return value;
}

function orderedContentToObject(content: any): any {
    if (!Array.isArray(content) || content.length === 0) {
        return {};
    }

    const result: Record<string, any> = {};
    const textValues: any[] = [];
    let hasElementChildren = false;

    content.forEach((child: OrderedXmlNode) => {
        const childTag = getOrderedTag(child);
        if (!childTag) return;

        if (childTag === TEXT_KEY) {
            textValues.push(child[TEXT_KEY]);
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

function appendValue(target: Record<string, any>, key: string, value: any) {
    if (target[key] === undefined) {
        target[key] = value;
    } else if (Array.isArray(target[key])) {
        target[key].push(value);
    } else {
        target[key] = [target[key], value];
    }
}

function isRecord(value: any): value is Record<string, any> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
