
// Helper to generate IDs
let eventIdCounter = 0;
export function generateEventId() {
    return `ev${++eventIdCounter}`;
}

export function resetEventIdCounter() {
    eventIdCounter = 0;
}
