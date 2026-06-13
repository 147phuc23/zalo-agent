const historyByThread = new Map();
const intentByThread = new Map();
export function resetMockStore() {
    historyByThread.clear();
    intentByThread.clear();
}
export function saveHistory(input) {
    const key = threadKey(input.tenantId, input.threadId);
    const existing = historyByThread.get(key) ?? [];
    const next = [...existing, ...input.entries];
    historyByThread.set(key, next);
    return { stored: input.entries.length, total: next.length };
}
export function getHistory(input) {
    return historyByThread.get(threadKey(input.tenantId, input.threadId)) ?? [];
}
export function saveIntent(input) {
    const record = {
        ...input,
        updatedAt: new Date().toISOString(),
    };
    intentByThread.set(threadKey(input.tenantId, input.threadId), record);
    return record;
}
export function getIntent(input) {
    return intentByThread.get(threadKey(input.tenantId, input.threadId)) ?? null;
}
function threadKey(tenantId, threadId) {
    return `${tenantId}:${threadId}`;
}
