import { vi, describe, it, expect, beforeEach } from "vitest";

const mockGenerate = vi.fn();

vi.mock("@platform/ai-client", () => {
  return {
    OpenRouterAiClient: class {
      generate = mockGenerate;
    },
  };
});

import { createNormalizeRequirementTool } from "./handler.js";

describe("normalize-requirement", () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it("normalizes a raw query using the LLM and validates inputs", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        role: "backend engineer",
        skills: ["Node.js", "SQL"],
        workMode: "remote",
        salaryMinVnd: 50000000,
        yearsOfExperience: 3,
        availability: "immediate",
        language: "english",
      }),
      model: "tencent/hy3:free",
    });

    const toolInstance = createNormalizeRequirementTool();
    const result = await toolInstance.execute(
      {
        rawText: "I want a hybrid Node job in HCM for 2k USD",
      },
      {} as any
    );

    expect(result.requirement).toEqual({
      role: "backend engineer",
      skills: ["node.js", "sql"],
      locationSlugs: ["ho-chi-minh-city"], // derived from "HCM" in rawText
      workMode: "remote",
      salaryMinVnd: 50000000,
      yearsOfExperience: 3,
      availability: "immediate",
      language: "english",
    });
  });
});
