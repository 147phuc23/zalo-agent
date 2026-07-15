import { tool } from "ai";
import { z } from "zod";
import type { JobPosting } from "../../types.js";
import { mockJobs } from "../load-jobs/mock-data.js";
import { CANONICAL_LOCATIONS } from "../../core/location-normalizer.js";

export interface LoadJobFiltersContext {
  listJobs?: () => Promise<JobPosting[]>;
}

export function createLoadJobFiltersTool(ctx?: LoadJobFiltersContext) {
  return tool({
    description: "Load all available job filter options (valid locations, roles, and common skills) from the job postings database.",
    parameters: z.object({}),
    execute: async () => {
      let source: JobPosting[] = mockJobs;
      if (ctx?.listJobs) {
        try {
          const fromDb = await ctx.listJobs();
          if (fromDb.length > 0) source = fromDb;
        } catch (err) {
          console.error("[load-job-filters] DB lookup failed, falling back to mock:", err);
        }
      }

      const locations = Array.from(new Set(source.flatMap((job) => job.locationSlugs)));
      const roles = Array.from(new Set(source.map((job) => job.title.toLowerCase())));
      const commonSkills = Array.from(new Set(source.flatMap((job) => job.requiredSkills.map(s => s.toLowerCase()))));

      return {
        locations: locations.length > 0 ? locations : CANONICAL_LOCATIONS.map((loc) => loc.slug),
        roles,
        workModes: ["remote", "hybrid", "onsite"],
        commonSkills,
      };
    },
  });
}
