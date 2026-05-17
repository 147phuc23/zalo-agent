import { describe, expect, it } from "vitest";
import { mapTwentyJobPostingRecord, mapTwentyPersonToCandidateProfile } from "./person-mapper.js";

describe("person-mapper", () => {
  it("maps Twenty Person records into CandidateProfile", () => {
    const profile = mapTwentyPersonToCandidateProfile({
      externalUserId: "zalo-1",
      record: {
        name: { firstName: "Minh", lastName: "Nguyen" },
        emails: { primaryEmail: "minh@example.local" },
        phones: { primaryPhoneNumber: "+8490" },
        externalUserId: "zalo-1",
        skillsSummary: "React, TypeScript",
        preferredRolesSummary: "Frontend Engineer",
        salaryExpectationVnd: 40_000_000,
        yearsExperience: 4,
        recruitingPipelineStage: "screening",
      },
    });

    expect(profile.externalUserId).toBe("zalo-1");
    expect(profile.displayName).toBe("Minh Nguyen");
    expect(profile.email).toBe("minh@example.local");
    expect(profile.skills).toEqual(["React", "TypeScript"]);
    expect(profile.preferredRoles).toEqual(["Frontend Engineer"]);
    expect(profile.notes?.[0]).toContain("Recruiting pipeline stage");
  });

  it("maps job posting records", () => {
    const job = mapTwentyJobPostingRecord({
      id: "job-1",
      name: "Frontend Engineer",
      companyName: "Acme",
      location: "HCMC",
      workMode: "hybrid",
      salaryMinVnd: 10,
      salaryMaxVnd: 20,
      seniority: "mid",
      requiredSkills: "React, Node",
      description: "Build things",
    });

    expect(job.id).toBe("job-1");
    expect(job.title).toBe("Frontend Engineer");
    expect(job.requiredSkills).toEqual(["React", "Node"]);
  });
});
