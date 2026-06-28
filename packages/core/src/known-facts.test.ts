import { describe, it, expect, vi } from "vitest";
import { buildKnownFacts } from "./known-facts.js";

describe("buildKnownFacts", () => {
  it("returns undefined when there are no audits", async () => {
    const mockRepos = {
      audits: {
        listByConversation: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await buildKnownFacts(mockRepos, "conv-1");
    expect(result).toBeUndefined();
  });

  it("extracts and formats requirement, intent, profile facts, and jobs shown from successful audits", async () => {
    const mockAudits = [
      {
        tool_name: "crm_getCandidateProfile",
        status: "ok",
        output: JSON.stringify({
          displayName: "Alex",
          phone: "+8499999999",
          location: "Hanoi",
        }),
      },
      {
        tool_name: "hr_gatherRequirement",
        status: "ok",
        output: JSON.stringify({
          requirement: {
            role: "Backend Engineer",
            workMode: "remote",
          },
        }),
      },
      {
        tool_name: "jobs_search",
        status: "ok",
        output: JSON.stringify({
          jobs: [
            { id: "job-1", title: "Senior Node.js Developer", company: "Acme Corp" },
            { id: "job-2", title: "Backend Engineer", company: "Globex" },
          ],
        }),
      },
      {
        tool_name: "memory_saveInteractionIntent",
        status: "ok",
        output: JSON.stringify({
          intent: "seeking_jobs",
          requirement: {
            salaryMinVnd: 30000000,
          },
        }),
      },
      {
        tool_name: "hr_gatherRequirement",
        status: "error",
        output: JSON.stringify({
          requirement: {
            role: "Frontend Engineer",
          },
        }),
      },
    ];

    const mockRepos = {
      audits: {
        listByConversation: vi.fn().mockResolvedValue(mockAudits),
      },
    } as any;

    const result = await buildKnownFacts(mockRepos, "conv-1");

    expect(result).toBeDefined();
    expect(result).toContain("# Known Facts So Far");
    expect(result).toContain("- Intent: seeking_jobs");
    expect(result).toContain("- Requirement: role=Backend Engineer, workMode=remote, salaryMinVnd=30000000");
    expect(result).toContain("- CRM Profile Facts: displayName: Alex, phone: +8499999999, location: Hanoi");
    expect(result).toContain("- Jobs already shown: [job-1] Senior Node.js Developer @ Acme Corp, [job-2] Backend Engineer @ Globex");
  });
});
