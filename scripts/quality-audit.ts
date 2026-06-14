import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

type FileMetrics = {
    path: string;
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
};

type FunctionMetrics = {
    path: string;
    name: string;
    line: number;
    lines: number;
    complexity: number;
};

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const EXCLUDED_DIRS = new Set([".git", ".codex-research", "coverage", "dist", "node_modules"]);

const REPORT_LIMIT = 12;
const LARGE_FILE_WARNING = 500;
const LARGE_FUNCTION_WARNING = 120;
const COMPLEXITY_WARNING = 12;

const root = process.cwd();
const strictMode = process.argv.includes("--strict");

function toDisplayPath(path: string): string {
    return relative(root, path).split(sep).join("/");
}

function isSourceFile(path: string): boolean {
    return SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function collectSourceFiles(directory: string, files: string[] = []): string[] {
    for (const entry of readdirSync(directory)) {
        if (EXCLUDED_DIRS.has(entry)) continue;

        const absolutePath = join(directory, entry);
        const stat = statSync(absolutePath);

        if (stat.isDirectory()) {
            collectSourceFiles(absolutePath, files);
            continue;
        }

        if (stat.isFile() && isSourceFile(absolutePath)) {
            files.push(absolutePath);
        }
    }

    return files;
}

function countLines(source: string): Omit<FileMetrics, "path"> {
    const lines = source.split(/\r?\n/);
    let blankLines = 0;
    let commentLines = 0;
    let blockCommentDepth = 0;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.length === 0) {
            blankLines += 1;
            continue;
        }

        if (blockCommentDepth > 0) {
            commentLines += 1;
            if (trimmed.includes("*/")) {
                blockCommentDepth -= 1;
            }
            continue;
        }

        if (trimmed.startsWith("//")) {
            commentLines += 1;
            continue;
        }

        if (trimmed.startsWith("/*")) {
            commentLines += 1;
            if (!trimmed.includes("*/")) {
                blockCommentDepth += 1;
            }
        }
    }

    return {
        totalLines: lines.length,
        codeLines: lines.length - blankLines - commentLines,
        commentLines,
        blankLines,
    };
}

function functionNameFromLine(line: string): string | undefined {
    const namedFunction = line.match(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/u);
    if (namedFunction?.[1]) return namedFunction[1];

    const assignedFunction = line.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/u);
    if (assignedFunction?.[1] && /=>|\bfunction\b/u.test(line)) return assignedFunction[1];

    const method = line.match(/^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/u);
    if (method?.[1] && !["if", "for", "while", "switch", "catch"].includes(method[1])) {
        return method[1];
    }

    return undefined;
}

function countBraceDelta(line: string): number {
    const withoutStrings = line
        .replace(/`(?:\\.|[^`])*`/gu, "``")
        .replace(/"(?:\\.|[^"])*"/gu, '""')
        .replace(/'(?:\\.|[^'])*'/gu, "''");

    return [...withoutStrings].reduce((delta, char) => {
        if (char === "{") return delta + 1;
        if (char === "}") return delta - 1;
        return delta;
    }, 0);
}

function complexityContribution(line: string): number {
    const withoutLineComment = line.replace(/\/\/.*$/u, "");
    const keywords = withoutLineComment.match(/\b(if|for|while|case|catch)\b/gu)?.length ?? 0;
    const logical = withoutLineComment.match(/&&|\|\|/gu)?.length ?? 0;
    const ternary = withoutLineComment.includes("?") && withoutLineComment.includes(":") ? 1 : 0;

    return keywords + logical + ternary;
}

function collectFunctionMetrics(path: string, source: string): FunctionMetrics[] {
    const lines = source.split(/\r?\n/);
    const functions: FunctionMetrics[] = [];
    let active:
        | {
              name: string;
              startLine: number;
              braceDepth: number;
              complexity: number;
          }
        | undefined;

    lines.forEach((line, index) => {
        const lineNumber = index + 1;

        if (!active) {
            const name = functionNameFromLine(line);
            if (!name) return;

            active = {
                name,
                startLine: lineNumber,
                braceDepth: countBraceDelta(line),
                complexity: 1 + complexityContribution(line),
            };

            if (active.braceDepth <= 0 && line.includes("{")) {
                functions.push({
                    path: toDisplayPath(path),
                    name: active.name,
                    line: active.startLine,
                    lines: lineNumber - active.startLine + 1,
                    complexity: active.complexity,
                });
                active = undefined;
            }
            return;
        }

        active.braceDepth += countBraceDelta(line);
        active.complexity += complexityContribution(line);

        if (active.braceDepth <= 0) {
            functions.push({
                path: toDisplayPath(path),
                name: active.name,
                line: active.startLine,
                lines: lineNumber - active.startLine + 1,
                complexity: active.complexity,
            });
            active = undefined;
        }
    });

    return functions;
}

function printTable<Row extends Record<string, string | number>>(
    rows: Row[],
    columns: Array<keyof Row>,
): void {
    if (rows.length === 0) {
        console.log("  None");
        return;
    }

    const widths = columns.map((column) =>
        Math.max(String(column).length, ...rows.map((row) => String(row[column]).length)),
    );

    console.log(
        `  ${columns.map((column, index) => String(column).padEnd(widths[index])).join("  ")}`,
    );
    console.log(`  ${widths.map((width) => "-".repeat(width)).join("  ")}`);

    for (const row of rows) {
        console.log(
            `  ${columns
                .map((column, index) => String(row[column]).padEnd(widths[index]))
                .join("  ")}`,
        );
    }
}

const files = collectSourceFiles(root);
const fileMetrics: FileMetrics[] = [];
const functionMetrics: FunctionMetrics[] = [];

for (const file of files) {
    const source = readFileSync(file, "utf8");
    fileMetrics.push({
        path: toDisplayPath(file),
        ...countLines(source),
    });
    functionMetrics.push(...collectFunctionMetrics(file, source));
}

const totals = fileMetrics.reduce(
    (accumulator, file) => ({
        totalLines: accumulator.totalLines + file.totalLines,
        codeLines: accumulator.codeLines + file.codeLines,
        commentLines: accumulator.commentLines + file.commentLines,
        blankLines: accumulator.blankLines + file.blankLines,
    }),
    { totalLines: 0, codeLines: 0, commentLines: 0, blankLines: 0 },
);

const commentRatio =
    totals.codeLines === 0
        ? 0
        : (totals.commentLines / (totals.codeLines + totals.commentLines)) * 100;

const largestFiles = [...fileMetrics]
    .sort((left, right) => right.totalLines - left.totalLines)
    .slice(0, REPORT_LIMIT)
    .map((file) => ({
        lines: file.totalLines,
        code: file.codeLines,
        comments: file.commentLines,
        path: file.path,
    }));

const largestFunctions = [...functionMetrics]
    .sort((left, right) => right.lines - left.lines)
    .slice(0, REPORT_LIMIT)
    .map((fn) => ({
        lines: fn.lines,
        complexity: fn.complexity,
        location: `${fn.path}:${fn.line}`,
        name: fn.name,
    }));

const complexFunctions = [...functionMetrics]
    .sort((left, right) => right.complexity - left.complexity)
    .slice(0, REPORT_LIMIT)
    .map((fn) => ({
        complexity: fn.complexity,
        lines: fn.lines,
        location: `${fn.path}:${fn.line}`,
        name: fn.name,
    }));

const largeFileCount = fileMetrics.filter((file) => file.totalLines > LARGE_FILE_WARNING).length;
const largeFunctionCount = functionMetrics.filter((fn) => fn.lines > LARGE_FUNCTION_WARNING).length;
const complexFunctionCount = functionMetrics.filter(
    (fn) => fn.complexity > COMPLEXITY_WARNING,
).length;

console.log("Melos quality audit");
console.log("===================");
console.log(`Files: ${files.length}`);
console.log(`Total lines: ${totals.totalLines}`);
console.log(`Code lines: ${totals.codeLines}`);
console.log(`Comment lines: ${totals.commentLines}`);
console.log(`Approx comment ratio: ${commentRatio.toFixed(2)}%`);
console.log(`Large files > ${LARGE_FILE_WARNING} lines: ${largeFileCount}`);
console.log(`Large functions > ${LARGE_FUNCTION_WARNING} lines: ${largeFunctionCount}`);
console.log(`Functions over complexity ${COMPLEXITY_WARNING}: ${complexFunctionCount}`);
console.log("");

console.log("Largest files");
printTable(largestFiles, ["lines", "code", "comments", "path"]);
console.log("");

console.log("Largest functions");
printTable(largestFunctions, ["lines", "complexity", "location", "name"]);
console.log("");

console.log("Highest approximate complexity");
printTable(complexFunctions, ["complexity", "lines", "location", "name"]);

if (strictMode && (largeFileCount > 0 || largeFunctionCount > 0 || complexFunctionCount > 0)) {
    process.exitCode = 1;
}
