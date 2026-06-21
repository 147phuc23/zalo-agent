import type { TestCase } from "./types.js";

export const offTopic: TestCase = {
  id: "off-topic",
  description: "User asks something completely unrelated to recruiting",
  turns: [
    { role: "user", content: "Bạn có thể viết code Python cho mình không?" },
  ],
  assertions: [
    { type: "skill-not-called", skillId: "jobs_search" },
  ],
};
