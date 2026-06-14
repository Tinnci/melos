import { getSmuflChar, SMUFL_FONT_STACK } from "./smufl";

export type RenderElement = string;

export class SvgRenderBackend {
    smuflGlyph(
        glyphName: string,
        x: number,
        y: number,
        fontSize: number,
        attrs = "",
    ): RenderElement {
        const char = getSmuflChar(glyphName);
        if (!char) return "";

        return `<text x="${x}" y="${y}" class="smufl-glyph" font-family="${SMUFL_FONT_STACK}" font-size="${fontSize}" ${attrs} data-smufl-glyph="${glyphName}">${char}</text>\n`;
    }

    smuflGlyphs(
        glyphNames: string[],
        x: number,
        y: number,
        fontSize: number,
        attrs = "",
    ): RenderElement {
        const chars = glyphNames
            .map((glyphName) => getSmuflChar(glyphName))
            .filter(Boolean)
            .join("");
        if (!chars) return "";

        return `<text x="${x}" y="${y}" class="smufl-glyph" font-family="${SMUFL_FONT_STACK}" font-size="${fontSize}" ${attrs} data-smufl-glyph="${glyphNames.join(" ")}">${chars}</text>\n`;
    }

    escapeXml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
}
