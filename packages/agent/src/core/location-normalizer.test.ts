import { describe, it, expect } from "vitest";
import { normalizeLocation, extractLocationSlugs, normalizeLocationToSlug, scoreJob } from "./location-normalizer.js";

describe("location-normalizer", () => {
  describe("normalizeLocation", () => {
    it("normalizes Ho Chi Minh City variations", () => {
      expect(normalizeLocation("hcm")).toBe("Ho Chi Minh City");
      expect(normalizeLocation("HCMC")).toBe("Ho Chi Minh City");
      expect(normalizeLocation("Hồ Chí Minh")).toBe("Ho Chi Minh City");
      expect(normalizeLocation("saigon")).toBe("Ho Chi Minh City");
      expect(normalizeLocation("Sai Gon")).toBe("Ho Chi Minh City");
    });

    it("normalizes Ha Noi variations", () => {
      expect(normalizeLocation("hanoi")).toBe("Ha Noi");
      expect(normalizeLocation("HN")).toBe("Ha Noi");
      expect(normalizeLocation("Hà Nội")).toBe("Ha Noi");
    });

    it("normalizes Da Nang variations", () => {
      expect(normalizeLocation("da nang")).toBe("Da Nang");
      expect(normalizeLocation("Danang")).toBe("Da Nang");
      expect(normalizeLocation("Đà Nẵng")).toBe("Da Nang");
    });

    it("normalizes Remote variations", () => {
      expect(normalizeLocation("remote")).toBe("Remote");
    });

    it("leaves unknown locations as is", () => {
      expect(normalizeLocation("Can Tho")).toBe("Can Tho");
    });

    it("returns empty string for null/undefined/empty", () => {
      expect(normalizeLocation(null)).toBe("");
      expect(normalizeLocation(undefined)).toBe("");
      expect(normalizeLocation("")).toBe("");
    });

    it("does not match bare hn/dn as substrings of unrelated words", () => {
      // Regression: the old regex had unanchored `hn`/`dn` alternatives that matched
      // inside ordinary words, silently mislabeling candidate/job locations.
      expect(normalizeLocation("Phnom Penh")).toBe("Phnom Penh");
      expect(normalizeLocation("Wednesday delivery")).toBe("Wednesday delivery");
      expect(normalizeLocationToSlug("Phnom Penh")).toBeUndefined();
      expect(normalizeLocationToSlug("Wednesday delivery")).toBeUndefined();
    });

    it("still matches standalone hn/dn tokens", () => {
      expect(normalizeLocation("I'm based in HN")).toBe("Ha Noi");
      expect(normalizeLocation("job is in DN")).toBe("Da Nang");
    });
  });

  describe("extractLocationSlugs", () => {
    it("returns every canonical city mentioned in free text", () => {
      expect(extractLocationSlugs("I can work in HCM or remote")).toEqual(
        expect.arrayContaining(["ho-chi-minh-city", "remote"]),
      );
      expect(extractLocationSlugs("I can work in HCM or remote")).toHaveLength(2);
    });

    it("returns an empty array when nothing matches", () => {
      expect(extractLocationSlugs("Phnom Penh, Cambodia")).toEqual([]);
      expect(extractLocationSlugs(undefined)).toEqual([]);
    });
  });

  describe("scoreJob", () => {
    const sampleJob = {
      title: "Senior Software Engineer (Java)",
      location: "Ho Chi Minh City, Vietnam",
      locationSlugs: ["ho-chi-minh-city"],
      workMode: "onsite" as const,
      salaryMaxVnd: 0, // negotiable
      requiredSkills: ["Java", "Spring Boot", "AWS"],
    };

    it("matches multi-word role queries when every word is present", () => {
      const filters = { role: "Senior Java" };
      const { score, reasons } = scoreJob(sampleJob, filters);
      expect(score).toBe(4);
      expect(reasons).toContain('role "Senior Java" partial match aligns with title (senior, java)');
    });

    it("does not match on a single shared word between unrelated roles", () => {
      // Regression: "Frontend Engineer" must not match "... Engineer ..." on the word
      // "engineer" alone — every filter word must be present.
      const filters = { role: "Frontend Engineer" };
      const { score } = scoreJob(sampleJob, filters);
      expect(score).toBe(0);
    });

    it("matches canonical location slugs regardless of free-text phrasing", () => {
      const filters = { locations: ["HCM"] };
      const { score, reasons } = scoreJob(sampleJob, filters);
      expect(score).toBe(2);
      expect(reasons).toContain("location match");
    });

    it("falls back to a substring match for cities outside the canonical set", () => {
      const outOfSetJob = { ...sampleJob, location: "Can Tho, Vietnam", locationSlugs: [] };
      const filters = { locations: ["Can Tho"] };
      const { score, reasons } = scoreJob(outOfSetJob, filters);
      expect(score).toBe(2);
      expect(reasons).toContain("location substring match");
    });

    it("matches negotiable/unspecified salaries when candidate specifies min salary", () => {
      const filters = { salaryMinVnd: 35000000 };
      const { score, reasons } = scoreJob(sampleJob, filters);
      expect(score).toBe(2);
      expect(reasons).toContain("salary is negotiable/unspecified");
    });

    it("matches exact work mode", () => {
      const filters = { workMode: "onsite" as const };
      const { score } = scoreJob(sampleJob, filters);
      expect(score).toBe(2);
    });

    it("returns 0 score when no criteria match", () => {
      const filters = {
        role: "React Developer",
        locations: ["Hanoi"],
        workMode: "remote" as const,
        salaryMinVnd: 45000000,
      };
      const { score } = scoreJob(sampleJob, filters);
      expect(score).toBe(0);
    });
  });
});
