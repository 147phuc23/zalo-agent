import { describe, it, expect } from "vitest";
import { normalizeLocation, scoreJob } from "./location-normalizer.js";

describe("location-normalizer", () => {
  describe("normalizeLocation", () => {
    it("normalizes Ho Chi Minh City variations", () => {
      expect(normalizeLocation("hcm")).toBe("Ho Chi Minh City");
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
  });

  describe("scoreJob", () => {
    const sampleJob = {
      title: "Senior Software Engineer (Java)",
      location: "Ho Chi Minh City, Vietnam",
      workMode: "onsite" as const,
      salaryMaxVnd: 0, // negotiable
      requiredSkills: ["Java", "Spring Boot", "AWS"],
    };

    it("matches multi-word role queries partially", () => {
      const filters = { role: "Senior Java" };
      const { score, reasons } = scoreJob(sampleJob, filters);
      expect(score).toBe(4); // both words match title
      expect(reasons).toContain("role partial match (senior, java)");
    });

    it("normalizes and matches location abbreviations", () => {
      const filters = { location: "HCM" };
      const { score, reasons } = scoreJob(sampleJob, filters);
      expect(score).toBe(2);
      expect(reasons).toContain("location exact match");
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
        location: "Hanoi",
        workMode: "remote" as const,
        salaryMinVnd: 45000000,
      };
      const { score } = scoreJob(sampleJob, filters);
      expect(score).toBe(0);
    });
  });
});
