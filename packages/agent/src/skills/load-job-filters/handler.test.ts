import { describe, expect, it } from "vitest";
import { createLoadJobFiltersTool } from "./handler.js";

describe("load-job-filters", () => {
  it("extracts unique locations, roles, and skills from job postings", async () => {
    const listJobs = async () => [
      {
        id: "job-1",
        title: "Backend Engineer",
        company: "Acme",
        locationSlugs: ["ha-noi"],
        workMode: "remote" as const,
        salaryMinVnd: 10,
        salaryMaxVnd: 20,
        seniority: "mid",
        requiredSkills: ["Node", "SQL"],
        description: "desc",
      },
    ];

    const toolInstance = createLoadJobFiltersTool({ listJobs });
    const result = await toolInstance.execute({}, {} as any);

    expect(result.locations).toContain("ha-noi");
    expect(result.roles).toContain("backend engineer");
    expect(result.commonSkills).toContain("node");
    expect(result.workModes).toEqual(["remote", "hybrid", "onsite"]);
  });
});
