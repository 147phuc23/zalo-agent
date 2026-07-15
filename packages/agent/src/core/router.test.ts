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
      model: "tencent/hy3:free",
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
      model: "tencent/hy3:free",
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
      model: "tencent/hy3:free",
    });

    const result = await classifyIntent([{ role: "user", content: "Chào" }]);

    expect(result.category).toBe("HR_SPECIALIST");
    expect(result.reason).toContain("Fallback");
  });

  it("returns normalizedRequirement merged with the passed-in currentRequirement", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        category: "HR_SPECIALIST",
        reason: "User wants a backend role",
        normalizedRequirement: {
          role: "backend engineer",
          skills: ["Node.js", "SQL"],
          workMode: "remote",
        },
      }),
      model: "tencent/hy3:free",
    });

    const result = await classifyIntent(
      [{ role: "user", content: "Mình muốn làm backend, biết Node.js" }],
      "tencent/hy3:free",
      undefined,
      { yearsOfExperience: 3 },
    );

    expect(result.normalizedRequirement).toEqual({
      yearsOfExperience: 3,
      role: "backend engineer",
      skills: ["node.js", "sql"],
      workMode: "remote",
    });
  });

  it("drops invalid role/availability/language values while keeping valid fields", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        category: "HR_SPECIALIST",
        reason: "test",
        normalizedRequirement: {
          role: "astronaut",
          availability: "asap",
          language: "french",
          workMode: "hybrid",
        },
      }),
      model: "tencent/hy3:free",
    });

    const result = await classifyIntent([{ role: "user", content: "test" }]);

    expect(result.normalizedRequirement).toEqual({ workMode: "hybrid" });
  });

  it("re-derives locationSlugs from raw message text instead of trusting the LLM's proposed slugs", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        category: "HR_SPECIALIST",
        reason: "test",
        normalizedRequirement: { locationSlugs: ["totally-made-up-slug"] },
      }),
      model: "tencent/hy3:free",
    });

    const result = await classifyIntent([
      { role: "user", content: "Mình muốn làm ở Đà Nẵng" },
    ]);

    expect(result.normalizedRequirement?.locationSlugs).not.toContain("totally-made-up-slug");
    expect(result.normalizedRequirement?.locationSlugs).toContain("da-nang");
  });

  it("keeps the existing requirement unchanged when classifier JSON is invalid", async () => {
    mockGenerate.mockResolvedValue({
      text: "This is not valid JSON",
      model: "tencent/hy3:free",
    });

    const existing = { role: "backend engineer", yearsOfExperience: 5 };
    const result = await classifyIntent(
      [{ role: "user", content: "Chào" }],
      "tencent/hy3:free",
      undefined,
      existing,
    );

    expect(result.normalizedRequirement).toEqual(existing);
  });

  it("generates a friendly chitchat reply", async () => {
    mockGenerate.mockResolvedValue({
      text: "Chào bạn! Mình có thể giúp gì cho bạn hôm nay? 😊",
      model: "tencent/hy3:free",
    });

    const result = await generateChitchatReply([{ role: "user", content: "Chào bạn" }]);

    expect(result).toBe("Chào bạn! Mình có thể giúp gì cho bạn hôm nay? 😊");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("includes the shared persona examples in the chitchat system prompt", async () => {
    mockGenerate.mockResolvedValue({
      text: "Chào bạn!",
      model: "tencent/hy3:free",
    });

    await generateChitchatReply([{ role: "user", content: "Chào bạn" }]);

    const callArgs = mockGenerate.mock.calls[0][0];
    expect(callArgs.system).toContain("Hoàng Phúc");
    expect(callArgs.system).toContain("Java Backend hả");
  });
});
