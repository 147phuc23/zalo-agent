import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("submits application through registered tool (mock fallback)", async () => {
    const tools = createAgentTools([]);
    const res = await tools.applications_submit.execute?.({
      jobId: "job-123",
      note: "Looking forward to it",
    }, toolOptions);

    expect(res).toMatchObject({
      applicationId: "mock-app-id-123",
      created: true,
      jobTitle: "NodeJS Developer (Mock)",
      companyName: "Company X (Mock)",
    });
  });

  it("gets application status through registered tool (mock fallback)", async () => {
    const tools = createAgentTools([]);
    const res = await tools.applications_getStatus.execute?.({}, toolOptions);

    expect(res).toBeInstanceOf(Array);
    expect(res[0]).toMatchObject({
      jobTitle: "NodeJS Developer (Mock)",
      companyName: "Company X (Mock)",
      stage: "interviewing",
      status: "active",
    });
  });

  it("records knowledge gap through registered tool (mock fallback)", async () => {
    const tools = createAgentTools([]);
    const res = await tools.knowledge_recordGap.execute?.({
      question: "Ai là CEO của FPT?",
      companyName: "FPT Software",
      topic: "company",
    }, toolOptions);

    expect(res).toMatchObject({
      id: "mock-gap-id-123",
      duplicate: false,
    });
  });

  it("matches candidate through registered tool (mock fallback)", async () => {
    const tools = createAgentTools([]);
    const res = await tools.jobs_matchCandidate.execute?.({ limit: 2 }, toolOptions);

    expect(res).toBeInstanceOf(Array);
    expect(res[0]).toMatchObject({
      jobId: "mock-job-123",
      title: "Senior React Developer (Mock)",
      company: "TechCorp",
      matchScore: 0.92,
    });
  });

  it("computes hybrid match score in jobs_matchCandidate with context", async () => {
    const getCandidateProfile = vi.fn().mockResolvedValue({
      fullName: "Test Candidate",
      skills: ["React", "TypeScript", "Node.js"],
    });
    const matchJobs = vi.fn().mockResolvedValue([
      {
        id: "job-react",
        title: "React Specialist",
        company: "GreatCo",
        locationSlugs: ["remote"],
        workMode: "remote",
        requiredSkills: ["React", "TypeScript"],
        description: "Need React dev.",
        fts_rank: 0.8,
      },
    ]);

    const tools = createAgentTools([], {
      matchCandidate: { getCandidateProfile, matchJobs },
    });

    const res = await tools.jobs_matchCandidate.execute?.({ limit: 1 }, toolOptions);
    expect(res).toBeInstanceOf(Array);
    // Jaccard: intersection: ['React', 'TypeScript'] (2), union: ['React', 'TypeScript', 'Node.js'] (3) -> 2/3 = 0.67
    // Score: (0.8 * 0.4) + (0.67 * 0.6) = 0.32 + 0.4 = 0.72
    expect(res[0]).toMatchObject({
      jobId: "job-react",
      title: "React Specialist",
      company: "GreatCo",
      matchScore: 0.72,
    });
  });
});
