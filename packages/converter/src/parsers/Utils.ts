
// Helper to generate IDs
let eventIdCounter = 0;
export function generateEventId() {
    return `ev${++eventIdCounter}`;
}

let noteIdCounter = 0;
export function generateNoteId() {
    return `n${++noteIdCounter}`;
}

export function resetIdCounters() {
    eventIdCounter = 0;
    noteIdCounter = 0;
}
