import type { AgentHistoryEntry, CandidateRequirement } from "../types.js";

type IntentRecord = {
  tenantId: string;
  threadId: string;
  intent: string;
  requirement: CandidateRequirement;
  updatedAt: string;
};

const historyByThread = new Map<string, AgentHistoryEntry[]>();
const intentByThread = new Map<string, IntentRecord>();

export function resetMockStore() {
  historyByThread.clear();
  intentByThread.clear();
}

export function saveHistory(input: {
  tenantId: string;
  threadId: string;
  entries: AgentHistoryEntry[];
}) {
  const key = threadKey(input.tenantId, input.threadId);
  const existing = historyByThread.get(key) ?? [];
  const next = [...existing, ...input.entries];
  historyByThread.set(key, next);
  return { stored: input.entries.length, total: next.length };
}

export function getHistory(input: { tenantId: string; threadId: string }) {
  return historyByThread.get(threadKey(input.tenantId, input.threadId)) ?? [];
}

export function saveIntent(input: {
  tenantId: string;
  threadId: string;
  intent: string;
  requirement: CandidateRequirement;
}) {
  const record = {
    ...input,
    updatedAt: new Date().toISOString(),
  };
  intentByThread.set(threadKey(input.tenantId, input.threadId), record);
  return record;
}

export function getIntent(input: { tenantId: string; threadId: string }) {
  return intentByThread.get(threadKey(input.tenantId, input.threadId)) ?? null;
}

function threadKey(tenantId: string, threadId: string) {
  return `${tenantId}:${threadId}`;
}
