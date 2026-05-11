import { beforeEach, describe, expect, it } from "vitest";
import { resetMockCandidateProfiles } from "./crm-get-candidate-profile/mock-data.js";
import { createAgentTools } from "./registry.js";

const toolOptions = {
  toolCallId: "test-tool-call",
  messages: [],
};

describe("agent CRM profile tools", () => {
  beforeEach(() => {
    resetMockCandidateProfiles();
  });

  it("updates a candidate profile through the registered tool", async () => {
    const tools = createAgentTools([]);
    const result = await tools.crm_updateCandidateProfile.execute?.({
      tenantId: "tenant-1",
      channel: "zalo",
      externalUserId: "zalo-candidate-frontend",
      patch: {
        currentTitle: "Senior Frontend Engineer",
        skills: ["React", "GraphQL"],
      },
    }, toolOptions);

    expect(result?.created).toBe(false);
    expect(result?.profile.currentTitle).toBe("Senior Frontend Engineer");
    expect(result?.profile.skills).toEqual(["React", "TypeScript", "Next.js", "GraphQL"]);
  });

  it("adds a note through the registered tool", async () => {
    const tools = createAgentTools([]);
    const result = await tools.crm_addCandidateProfileNote.execute?.({
      tenantId: "tenant-1",
      channel: "zalo",
      externalUserId: "zalo-candidate-new",
      note: "Candidate prefers product companies.",
      source: "zalo",
    }, toolOptions);

    expect(result?.created).toBe(true);
    expect(result?.note).toMatchObject({
      content: "Candidate prefers product companies.",
      source: "zalo",
    });
    expect(result?.profile.notes).toContain("Candidate prefers product companies.");
  });

  it("reads profile updates through the existing get tool", async () => {
    const tools = createAgentTools([]);

    await tools.crm_updateCandidateProfile.execute?.({
      tenantId: "tenant-1",
      channel: "zalo",
      externalUserId: "zalo-candidate-new",
      patch: {
        displayName: "Updated Candidate",
        preferredRoles: ["Backend Engineer"],
      },
    }, toolOptions);

    const profile = await tools.crm_getCandidateProfile.execute?.({
      tenantId: "tenant-1",
      channel: "zalo",
      externalUserId: "zalo-candidate-new",
    }, toolOptions);

    expect(profile).toMatchObject({
      externalUserId: "zalo-candidate-new",
      displayName: "Updated Candidate",
      preferredRoles: ["Backend Engineer"],
    });
  });
});
