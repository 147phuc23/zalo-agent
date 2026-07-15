import { describe, it, expect } from "vitest";
import { buildPromptCacheContext } from "./prompt-cache-context.js";
import type { SkillCacheResult, CandidateProfile, HrAgentState } from "../types.js";

describe("buildPromptCacheContext", () => {
  const mockSkillCache: SkillCacheResult = {
    status: "hit",
    skills: [],
    defaultSkillsPromptBlock: "# Skills Info",
    hash: "abc",
  };

  const mockProfile: CandidateProfile = {
    externalUserId: "user-123",
    displayName: "Test User",
    skills: [],
    preferredRoles: [],
  };

  const mockState: HrAgentState = {
    tenantId: "tenant-1",
    channel: "zalo",
    threadId: "thread-1",
    externalUserId: "user-123",
    version: 1,
    requirement: {},
    loadedSkills: [],
    history: [],
  };

  it("uses local instructions by default when systemPromptOverride is not provided", () => {
    const context = buildPromptCacheContext({
      skillCache: mockSkillCache,
      loadedSkills: [],
      customerProfile: mockProfile,
      state: mockState,
    });

    expect(context.system).toContain("# HR Recruitment Chat Agent System Prompt");
    expect(context.system).toContain("You are Hoàng Phúc, an AI Recruitment Assistant");
    expect(context.system).toContain("# Customer Profile Snapshot");
    expect(context.system).toContain("- displayName: Test User");
  });

  it("appends target message instruction to local instructions when only target message override is passed", () => {
    const targetMsgOverride = "\n\nIMPORTANT: The candidate has sent a message that you are replying to: \"hello\". Make sure your response specifically and directly replies to/quotes this message.";
    const context = buildPromptCacheContext({
      skillCache: mockSkillCache,
      loadedSkills: [],
      customerProfile: mockProfile,
      state: mockState,
      systemPromptOverride: targetMsgOverride,
    });

    expect(context.system).toContain("# HR Recruitment Chat Agent System Prompt");
    expect(context.system).toContain("You are Hoàng Phúc, an AI Recruitment Assistant");
    expect(context.system).toContain("IMPORTANT: The candidate has sent a message that you are replying to: \"hello\"");
    expect(context.system).toContain("# Customer Profile Snapshot");
  });

  it("replaces core instructions with database prompt content while preserving dynamic context", () => {
    const dbPromptOverride = "# Custom DB Prompt\nYou are a customized recruiter agent.";
    const context = buildPromptCacheContext({
      skillCache: mockSkillCache,
      loadedSkills: [],
      customerProfile: mockProfile,
      state: mockState,
      systemPromptOverride: dbPromptOverride,
    });

    expect(context.system).not.toContain("# HR Recruitment Chat Agent System Prompt");
    expect(context.system).toContain("# Custom DB Prompt");
    expect(context.system).toContain("You are a customized recruiter agent.");
    expect(context.system).toContain("# Customer Profile Snapshot");
    expect(context.system).toContain("- displayName: Test User");
  });

  it("handles db prompt and target message override combined", () => {
    const combinedOverride = "# Custom DB Prompt\nYou are a customized recruiter agent.\n\nIMPORTANT: The candidate has sent a message that you are replying to: \"hello\". Make sure your response specifically and directly replies to/quotes this message.";
    const context = buildPromptCacheContext({
      skillCache: mockSkillCache,
      loadedSkills: [],
      customerProfile: mockProfile,
      state: mockState,
      systemPromptOverride: combinedOverride,
    });

    expect(context.system).not.toContain("# HR Recruitment Chat Agent System Prompt");
    expect(context.system).toContain("# Custom DB Prompt");
    expect(context.system).toContain("You are a customized recruiter agent.");
    expect(context.system).toContain("IMPORTANT: The candidate has sent a message that you are replying to: \"hello\"");
    expect(context.system).toContain("# Customer Profile Snapshot");
  });
});
