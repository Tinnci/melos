import type { RenderBox, RenderDiagnostic, RenderDocument, RenderSpan } from "./renderDocument";

export type CollisionResolverInput = Pick<RenderDocument, "height" | "width"> & {
    boxes?: RenderBox[];
    spans?: RenderSpan[];
};

const OVERLAP_EPSILON = 0.001;

export function resolveRenderCollisions(document: CollisionResolverInput): RenderDiagnostic[] {
    const boxes = document.boxes ?? [];
    return [...detectMeasureOverflow(boxes), ...detectBoxCollisions(boxes)];
}

function detectMeasureOverflow(boxes: RenderBox[]): RenderDiagnostic[] {
    const diagnostics: RenderDiagnostic[] = [];
    const measures = new Map<string, RenderBox>();

    for (const box of boxes) {
        if (box.role === "measure") {
            measures.set(measureKey(box), box);
        }
    }

    for (const box of boxes) {
        if (!isOverflowCandidate(box)) continue;

        const measure = measures.get(measureKey(box));
        if (!measure) continue;

        const measureRight = measure.x + measure.width;
        const boxRight = box.x + box.width;
        if (boxRight <= measureRight + OVERLAP_EPSILON) continue;

        diagnostics.push({
            severity: "warning",
            code: "measure-overfull",
            message: `${box.role} box extends beyond measure ${box.measureIndex + 1}.`,
            path: box.sourcePath,
            boxIds: [measure.id, box.id],
        });
    }

    return diagnostics;
}

function detectBoxCollisions(boxes: RenderBox[]): RenderDiagnostic[] {
    const diagnostics: RenderDiagnostic[] = [];
    const candidates = boxes.filter(isCollisionCandidate);

    for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
        const left = candidates[leftIndex];
        if (!left) continue;

        for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
            const right = candidates[rightIndex];
            if (
                !right ||
                !canCompare(left, right) ||
                !boxesOverlap(left, right) ||
                !hasMeaningfulHorizontalOverlap(left, right)
            ) {
                continue;
            }

            diagnostics.push({
                severity: "warning",
                code: "collision-unresolved",
                message: `${left.role} and ${right.role} boxes overlap in measure ${left.measureIndex + 1}.`,
                path: left.sourcePath ?? right.sourcePath,
                boxIds: [left.id, right.id],
            });
        }
    }

    return diagnostics;
}

function isOverflowCandidate(box: RenderBox): boolean {
    return box.layer === "notation" && box.role !== "measure" && box.role !== "stave";
}

function isCollisionCandidate(box: RenderBox): boolean {
    return box.layer === "notation" && box.width > 0 && box.height > 0;
}

function canCompare(left: RenderBox, right: RenderBox): boolean {
    if (left.partIndex !== right.partIndex) return false;
    if (left.measureIndex !== right.measureIndex) return false;
    if (left.eventId && left.eventId === right.eventId) return false;
    if (left.sourcePath && left.sourcePath === right.sourcePath) return false;
    return collisionGroup(left) === collisionGroup(right);
}

function boxesOverlap(left: RenderBox, right: RenderBox): boolean {
    return (
        left.x < right.x + right.width - OVERLAP_EPSILON &&
        left.x + left.width > right.x + OVERLAP_EPSILON &&
        left.y < right.y + right.height - OVERLAP_EPSILON &&
        left.y + left.height > right.y + OVERLAP_EPSILON
    );
}

function hasMeaningfulHorizontalOverlap(left: RenderBox, right: RenderBox): boolean {
    const overlap =
        Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);
    const narrowerWidth = Math.min(left.width, right.width);
    if (narrowerWidth <= 0) return false;

    return overlap / narrowerWidth >= 0.5;
}

function collisionGroup(box: RenderBox): string {
    if (box.role === "note" || box.role === "rest" || box.role === "grace") return "timed";
    return box.role;
}

function measureKey(box: Pick<RenderBox, "measureIndex" | "partIndex">): string {
    return `${box.partIndex}:${box.measureIndex}`;
}
