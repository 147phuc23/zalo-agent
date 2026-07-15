import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateAndSaveReply } from "./reply.js";
import { runHrAgentScenario } from "@platform/agent";

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

  it("splits LLM output by <nl> tags and saves each as a separate message", async () => {
    vi.mocked(runHrAgentScenario).mockResolvedValueOnce({
      assistantText: "Chào bạn! 😊<nl>Đây là job Backend ngon lành nè:\n- Lương 35tr\n- Stack: Java<NL>Bạn thích job này không?",
      steps: [],
    } as any);

    await generateAndSaveReply(mockRepos, {
      tenantId: "tenant-1",
      conversationId: "conv-1",
    });

    expect(mockRepos.messages.createOutbound).toHaveBeenCalledTimes(3);
    expect(mockRepos.messages.createOutbound).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: "Chào bạn! 😊" })
    );
    expect(mockRepos.messages.createOutbound).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: "Đây là job Backend ngon lành nè:\n- Lương 35tr\n- Stack: Java" })
    );
    expect(mockRepos.messages.createOutbound).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: "Bạn thích job này không?" })
    );
  });
});
