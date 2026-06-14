import { getSmuflChar, SMUFL_FONT_STACK } from "./smufl";
import type {
    RenderAttributes,
    RenderDocument,
    RenderElement,
    RenderElementBase,
    RenderGroupElement,
    RenderHitboxElement,
    RenderLineElement,
    RenderPathElement,
    RenderRectElement,
    RenderSmuflGlyphElement,
    RenderTextElement,
} from "./renderDocument";

export type {
    RenderAttributeValue,
    RenderAttributes,
    RenderBox,
    RenderBoxLayer,
    RenderBoxRole,
    RenderDiagnostic,
    RenderDiagnosticSeverity,
    RenderDocument,
    RenderElement,
    RenderElementBase,
    RenderGroupElement,
    RenderHitboxElement,
    RenderLineElement,
    RenderPathElement,
    RenderRawElement,
    RenderRectElement,
    RenderSmuflGlyphElement,
    RenderSpan,
    RenderSpanRole,
    RenderTextElement,
} from "./renderDocument";

export class SvgRenderBackend {
    renderDocument(document: RenderDocument): string {
        const attrs = this.attributesToString({
            xmlns: "http://www.w3.org/2000/svg",
            width: document.width,
            height: document.height,
            ...document.attributes,
        });
        const styles = document.styles?.length
            ? `<style>\n${document.styles.join("\n")}\n</style>\n`
            : "";
        const body = document.elements.map((element) => this.renderElement(element)).join("");

        return `<svg ${attrs}>\n${styles}${body}</svg>`;
    }

    renderElement(element: RenderElement): string {
        switch (element.kind) {
            case "group":
                return this.renderGroup(element);
            case "hitbox":
                return this.renderHitbox(element);
            case "line":
                return this.renderLine(element);
            case "path":
                return this.renderPath(element);
            case "raw":
                return element.svg;
            case "rect":
                return this.renderRect(element);
            case "smuflGlyph":
                return this.renderSmuflGlyphElement(element);
            case "text":
                return this.renderText(element);
        }
    }

    smuflGlyph(glyphName: string, x: number, y: number, fontSize: number, attrs = ""): string {
        return this.renderElement({
            kind: "smuflGlyph",
            glyphName,
            x,
            y,
            fontSize,
            rawAttributes: attrs,
        });
    }

    smuflGlyphs(glyphNames: string[], x: number, y: number, fontSize: number, attrs = ""): string {
        return this.renderElement({
            kind: "smuflGlyph",
            glyphNames,
            x,
            y,
            fontSize,
            rawAttributes: attrs,
        });
    }

    text(element: Omit<RenderTextElement, "kind">): string {
        return this.renderElement({ ...element, kind: "text" });
    }

    hitbox(element: Omit<RenderHitboxElement, "kind">): string {
        return this.renderElement({ ...element, kind: "hitbox" });
    }

    group(element: Omit<RenderGroupElement, "kind">): string {
        return this.renderElement({ ...element, kind: "group" });
    }

    escapeXml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    private renderGroup(element: RenderGroupElement): string {
        const attrs = this.elementAttributes(element);
        const children = element.children.map((child) => this.renderElement(child)).join("");
        return `<g${attrs}>${children}</g>\n`;
    }

    private renderHitbox(element: RenderHitboxElement): string {
        const { style, ...customAttributes } = element.attributes ?? {};
        const attributes = this.attributesToString({
            class: element.className,
            ...customAttributes,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            fill: "transparent",
            stroke: "transparent",
            "pointer-events": "all",
            style,
        });
        const rawAttributes = element.rawAttributes?.trim();
        const attrs = rawAttributes ? `${attributes} ${rawAttributes}` : attributes;
        return `<rect ${attrs} />\n`;
    }

    private renderLine(element: RenderLineElement): string {
        const attrs = this.elementAttributes(element, {
            x1: element.x1,
            y1: element.y1,
            x2: element.x2,
            y2: element.y2,
        });
        return `<line${attrs} />\n`;
    }

    private renderPath(element: RenderPathElement): string {
        const attrs = this.elementAttributes(element, { d: element.d });
        return `<path${attrs} />\n`;
    }

    private renderRect(element: RenderRectElement): string {
        const attrs = this.elementAttributes(element, {
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
        });
        return `<rect${attrs} />\n`;
    }

    private renderSmuflGlyphElement(element: RenderSmuflGlyphElement): string {
        const glyphNames = element.glyphNames ?? (element.glyphName ? [element.glyphName] : []);
        const chars = glyphNames
            .map((glyphName) => getSmuflChar(glyphName))
            .filter(Boolean)
            .join("");
        if (!chars) return "";

        const attrs = this.elementAttributes(element, {
            x: element.x,
            y: element.y,
            class: "smufl-glyph",
            "font-family": SMUFL_FONT_STACK,
            "font-size": element.fontSize,
            "data-smufl-glyph": glyphNames.join(" "),
        });
        return `<text${attrs}>${chars}</text>\n`;
    }

    private renderText(element: RenderTextElement): string {
        const attrs = this.elementAttributes(element, {
            x: element.x,
            y: element.y,
            class: element.className,
            "font-family": element.fontFamily,
            "font-size": element.fontSize,
        });
        return `<text${attrs}>${this.escapeXml(element.text)}</text>\n`;
    }

    private elementAttributes(element: RenderElementBase, base: RenderAttributes = {}): string {
        const attributes = this.attributesToString({ ...base, ...element.attributes });
        const rawAttributes = element.rawAttributes?.trim();
        if (!rawAttributes) return attributes ? ` ${attributes}` : "";
        return attributes ? ` ${attributes} ${rawAttributes}` : ` ${rawAttributes}`;
    }

    private attributesToString(attributes: RenderAttributes): string {
        return Object.entries(attributes)
            .flatMap(([name, value]) => {
                if (value === undefined || value === false) return [];
                if (value === true) return [name];
                return [`${name}="${this.escapeXml(String(value))}"`];
            })
            .join(" ");
    }
}
