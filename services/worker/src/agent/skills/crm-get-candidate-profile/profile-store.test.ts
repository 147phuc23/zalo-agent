import { beforeEach, describe, expect, it } from "vitest";
import {
  addMockCandidateProfileNote,
  getMockCandidateProfile,
  resetMockCandidateProfiles,
  updateMockCandidateProfile,
} from "./profile-store.js";

const baseInput = {
  tenantId: "tenant-1",
  channel: "zalo" as const,
};

describe("mock candidate profile store", () => {
  beforeEach(() => {
    resetMockCandidateProfiles();
  });

  it("creates an unknown profile on update", () => {
    const result = updateMockCandidateProfile({
      ...baseInput,
      externalUserId: "zalo-candidate-new",
      patch: {
        displayName: "New Candidate",
        phone: "+84909999999",
      },
    });

    expect(result.created).toBe(true);
    expect(result.profile).toMatchObject({
      externalUserId: "zalo-candidate-new",
      displayName: "New Candidate",
      phone: "+84909999999",
    });
  });

  it("patches scalar fields without clearing unspecified fields", () => {
    const result = updateMockCandidateProfile({
      ...baseInput,
      externalUserId: "zalo-candidate-frontend",
      patch: {
        location: "Da Nang",
      },
    });

    expect(result.created).toBe(false);
    expect(result.profile.location).toBe("Da Nang");
    expect(result.profile.phone).toBe("+84901234567");
    expect(result.profile.email).toBe("minh.nguyen@example.local");
  });

  it("merges skills and preferred roles uniquely", () => {
    const result = updateMockCandidateProfile({
      ...baseInput,
      externalUserId: "zalo-candidate-frontend",
      patch: {
        skills: ["React", "GraphQL"],
        preferredRoles: ["Frontend Engineer", "Tech Lead"],
      },
    });

    expect(result.profile.skills).toEqual(["React", "TypeScript", "Next.js", "GraphQL"]);
    expect(result.profile.preferredRoles).toEqual([
      "Frontend Engineer",
      "Full-stack Engineer",
      "Tech Lead",
    ]);
  });

  it("appends notes without overwriting existing notes", () => {
    const result = addMockCandidateProfileNote({
      ...baseInput,
      externalUserId: "zalo-candidate-frontend",
      note: "Open to startups.",
      source: "zalo",
    });

    expect(result.created).toBe(false);
    expect(result.note).toMatchObject({
      content: "Open to startups.",
      source: "zalo",
    });
    expect(result.profile.notes).toEqual([
      "Previously asked for product companies",
      "Prefers hybrid teams",
      "Open to startups.",
    ]);
  });

  it("returns clones so callers cannot mutate stored profiles by reference", () => {
    const profile = getMockCandidateProfile({
      ...baseInput,
      externalUserId: "zalo-candidate-frontend",
    });
    profile.skills.push("Mutated");

    expect(getMockCandidateProfile({
      ...baseInput,
      externalUserId: "zalo-candidate-frontend",
    }).skills).not.toContain("Mutated");
  });
});
