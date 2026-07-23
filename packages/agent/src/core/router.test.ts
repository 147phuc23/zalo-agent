import { vi, describe, it, expect, beforeEach } from "vitest";

const mockGenerate = vi.fn();

vi.mock("@platform/ai-client", () => {
  return {
    OpenRouterAiClient: class {
      generate = mockGenerate;
    },
  };
});

import { classifyIntent, generateChitchatReply } from "./router.js";

describe("Router & Classifier Agent", () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it("classifies simple greeting message as CHITCHAT", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        category: "CHITCHAT",
        reason: "User said hello",
      }),
      model: "cohere/north-mini-code:free",
    });

    const result = await classifyIntent([{ role: "user", content: "Chào bạn!" }]);

    expect(result.category).toBe("CHITCHAT");
    expect(result.reason).toBe("User said hello");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("classifies job search requirement as HR_SPECIALIST", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        category: "HR_SPECIALIST",
        reason: "User wants to find a backend React job",
      }),
      model: "cohere/north-mini-code:free",
    });

    const result = await classifyIntent([
      { role: "user", content: "Mình đang tìm việc Nodejs ở Hà Nội" },
    ]);

    expect(result.category).toBe("HR_SPECIALIST");
    expect(result.reason).toBe("User wants to find a backend React job");
  });

  it("falls back to HR_SPECIALIST if classifier JSON is invalid", async () => {
    mockGenerate.mockResolvedValue({
      text: "This is not valid JSON",
      model: "cohere/north-mini-code:free",
    });

    const result = await classifyIntent([{ role: "user", content: "Chào" }]);

    expect(result.category).toBe("HR_SPECIALIST");
    expect(result.reason).toContain("Fallback");
  });

  it("generates a friendly chitchat reply", async () => {
    mockGenerate.mockResolvedValue({
      text: "Chào bạn! Mình có thể giúp gì cho bạn hôm nay? 😊",
      model: "cohere/north-mini-code:free",
    });

    const result = await generateChitchatReply([{ role: "user", content: "Chào bạn" }]);

    expect(result).toBe("Chào bạn! Mình có thể giúp gì cho bạn hôm nay? 😊");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("includes the shared persona examples in the chitchat system prompt", async () => {
    mockGenerate.mockResolvedValue({
      text: "Chào bạn!",
      model: "cohere/north-mini-code:free",
    });

    await generateChitchatReply([{ role: "user", content: "Chào bạn" }]);

    const callArgs = mockGenerate.mock.calls[0][0];
    expect(callArgs.system).toContain("Hoàng Phúc");
    expect(callArgs.system).toContain("Java Backend hả");
  });
});
