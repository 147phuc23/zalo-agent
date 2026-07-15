import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateAndSaveReply } from "./reply.js";
import { runHrAgentScenario, classifyIntent } from "@platform/agent";

vi.mock("@platform/agent", () => ({
  runHrAgentScenario: vi.fn().mockResolvedValue({
    assistantText: JSON.stringify(["Xin chào!"]),
    steps: [],
  }),
  classifyIntent: vi.fn().mockResolvedValue({ category: "AGENT", reason: "test" }),
  resolveHrSkillMode: vi.fn().mockReturnValue("default"),
}));

describe("generateAndSaveReply - USE_DB_PROMPT toggle", () => {
  let mockRepos: any;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockRepos = {
      messages: {
        listByConversation: vi.fn().mockResolvedValue([]),
        createOutbound: vi.fn().mockResolvedValue({ id: "msg-out" }),
      },
      conversations: {
        findById: vi.fn().mockResolvedValue({
          id: "conv-1",
          contact_id: "contact-1",
          override_model: "my-model",
        }),
      },
      contacts: {
        listByIds: vi.fn().mockResolvedValue([{ display_name: "Anh A", external_user_id: "ext-1" }]),
      },
      workflows: {
        findLatestByTenant: vi.fn().mockResolvedValue({ default_model: "def-model" }),
      },
      prompts: {
        findActive: vi.fn().mockResolvedValue({ content: "DB Prompt Content" }),
      },
      audits: {
        listByConversation: vi.fn().mockResolvedValue([]),
        append: vi.fn(),
      },
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("does not fetch prompt from DB by default (USE_DB_PROMPT unset)", async () => {
    delete process.env.USE_DB_PROMPT;

    await generateAndSaveReply(mockRepos, {
      tenantId: "tenant-1",
      conversationId: "conv-1",
    });

    expect(mockRepos.prompts.findActive).not.toHaveBeenCalled();
    expect(runHrAgentScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPromptOverride: undefined,
      })
    );
  });

  it("does not fetch prompt from DB when USE_DB_PROMPT is false", async () => {
    process.env.USE_DB_PROMPT = "false";

    await generateAndSaveReply(mockRepos, {
      tenantId: "tenant-1",
      conversationId: "conv-1",
    });

    expect(mockRepos.prompts.findActive).not.toHaveBeenCalled();
    expect(runHrAgentScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPromptOverride: undefined,
      })
    );
  });

  it("fetches prompt from DB when USE_DB_PROMPT is true", async () => {
    process.env.USE_DB_PROMPT = "true";

    await generateAndSaveReply(mockRepos, {
      tenantId: "tenant-1",
      conversationId: "conv-1",
    });

    expect(mockRepos.prompts.findActive).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      key: "assistant",
    });
    expect(runHrAgentScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPromptOverride: "DB Prompt Content",
      })
    );
  });

  it("writes a requirement_normalizer audit entry when classifyIntent returns a normalizedRequirement", async () => {
    vi.mocked(classifyIntent).mockResolvedValueOnce({
      category: "AGENT" as any,
      reason: "test",
      normalizedRequirement: { role: "backend engineer", workMode: "remote" },
    });

    await generateAndSaveReply(mockRepos, {
      tenantId: "tenant-1",
      conversationId: "conv-1",
    });

    expect(mockRepos.audits.append).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        conversationId: "conv-1",
        toolName: "requirement_normalizer",
        outputPayload: { requirement: { role: "backend engineer", workMode: "remote" } },
        status: "ok",
      }),
    );
  });

  it("does not write a requirement_normalizer audit entry when normalizedRequirement is absent", async () => {
    await generateAndSaveReply(mockRepos, {
      tenantId: "tenant-1",
      conversationId: "conv-1",
    });

    expect(mockRepos.audits.append).not.toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "requirement_normalizer" }),
    );
  });
});
