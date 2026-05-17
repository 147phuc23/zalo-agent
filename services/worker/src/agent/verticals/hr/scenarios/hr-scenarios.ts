import type { HrScenario, MockZaloPayload } from "../../../types.js";

const tenantId = "22222222-2222-2222-2222-222222222222";

export const hrScenarios: HrScenario[] = [
  {
    id: "first-contact-requirement",
    name: "First contact requirement",
    description: "Candidate starts a job search and leaves important fields missing.",
    tenantId,
    channel: "zalo",
    threadId: "zalo-thread-first-contact",
    externalUserId: "zalo-candidate-new",
    messages: [
      payload("msg-001", "zalo-thread-first-contact", "zalo-candidate-new", "Chào bạn, mình đang muốn tìm việc frontend."),
    ],
  },
  {
    id: "fragmented-zalo-messages",
    name: "Fragmented Zalo messages",
    description: "Candidate sends requirement details across several short messages.",
    tenantId,
    channel: "zalo",
    threadId: "zalo-thread-fragmented",
    externalUserId: "zalo-candidate-frontend",
    messages: [
      payload("msg-010", "zalo-thread-fragmented", "zalo-candidate-frontend", "Mình muốn frontend React"),
      payload("msg-011", "zalo-thread-fragmented", "zalo-candidate-frontend", "Hybrid ở HCM"),
      payload("msg-012", "zalo-thread-fragmented", "zalo-candidate-frontend", "Lương khoảng 45 triệu"),
    ],
  },
  {
    id: "job-matching",
    name: "Job matching",
    description: "Candidate gives enough data for job search.",
    tenantId,
    channel: "zalo",
    threadId: "zalo-thread-job-match",
    externalUserId: "zalo-candidate-backend",
    messages: [
      payload("msg-020", "zalo-thread-job-match", "zalo-candidate-backend", "Mình backend Node NestJS 5 năm ở Hà Nội, lương từ 55 triệu, onsite cũng được."),
    ],
  },
  {
    id: "no-matching-jobs",
    name: "No matching jobs",
    description: "Candidate asks for a constraint that likely returns no jobs.",
    tenantId,
    channel: "zalo",
    threadId: "zalo-thread-no-match",
    externalUserId: "zalo-candidate-frontend",
    messages: [
      payload("msg-030", "zalo-thread-no-match", "zalo-candidate-frontend", "Mình muốn frontend remote lương 120 triệu."),
    ],
  },
];

export function findScenario(id: string) {
  return hrScenarios.find((scenario) => scenario.id === id);
}

function payload(
  id: string,
  threadId: string,
  externalUserId: string,
  text: string,
): MockZaloPayload {
  return {
    id,
    tenantId,
    channel: "zalo",
    threadId,
    externalUserId,
    text,
    receivedAt: new Date().toISOString(),
    raw: {
      source: "mock-zalo",
      msgId: id,
      uidFrom: externalUserId,
      threadId,
      content: text,
    },
  };
}
