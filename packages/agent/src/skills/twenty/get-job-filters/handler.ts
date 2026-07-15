import { tool } from "ai";
import { z } from "zod";
import { getTwentyRecruitingClient } from "../client-singleton.js";
import { CANONICAL_LOCATIONS } from "../../../core/location-normalizer.js";

export function createTwentyGetJobFiltersTool() {
  return tool({
    description: "Load all available job filter options (valid locations, roles, and common skills) from Twenty CRM.",
    parameters: z.object({}),
    execute: async () => {
      const client = getTwentyRecruitingClient();
      try {
        const jobs = await client.searchJobPostings({});
        const locations = Array.from(new Set(jobs.flatMap((job) => job.locationSlugs)));
        const roles = Array.from(new Set(jobs.map((job) => job.title.toLowerCase())));
        const commonSkills = Array.from(new Set(jobs.flatMap((job) => job.requiredSkills.map(s => s.toLowerCase()))));

        return {
          locations: locations.length > 0 ? locations : CANONICAL_LOCATIONS.map((loc) => loc.slug),
          roles,
          workModes: ["remote", "hybrid", "onsite"],
          commonSkills,
        };
      } catch (err) {
        console.error("[twenty_getJobFilters] Twenty lookup failed, returning defaults:", err);
        return {
          locations: CANONICAL_LOCATIONS.map((loc) => loc.slug),
          roles: [],
          workModes: ["remote", "hybrid", "onsite"],
          commonSkills: [],
        };
      }
    },
  });
}
