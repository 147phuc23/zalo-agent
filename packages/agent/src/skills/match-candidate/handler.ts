import { tool } from "ai";
import { z } from "zod";

export interface MatchCandidateContext {
  getCandidateProfile?: () => Promise<{
    fullName?: string;
    skills: string[];
    summary?: string;
  } | null>;
  matchJobs?: (skills: string[], limit: number) => Promise<Array<{
    id: string;
    title: string;
    company: string;
    locationSlugs: string[];
    workMode: string;
    requiredSkills: string[];
    description: string;
    fts_rank?: number;
  }>>;
}

export function createMatchCandidateTool(ctx?: MatchCandidateContext) {
  return tool({
    description: "Match the current candidate's profile and skills with active job postings using hybrid scoring.",
    parameters: z.object({
      limit: z.number().optional().default(5).describe("Max number of matches to return."),
    }),
    execute: async ({ limit }) => {
      if (!ctx?.getCandidateProfile || !ctx?.matchJobs) {
        // Mock fallback
        return [
          {
            jobId: "mock-job-123",
            title: "Senior React Developer (Mock)",
            company: "TechCorp",
            matchScore: 0.92,
            requiredSkills: ["React", "TypeScript", "Node.js"],
            workMode: "remote",
            salaryText: "Competitive",
            description: "A mock matched job for testing.",
          },
        ];
      }

      try {
        const profile = await ctx.getCandidateProfile();
        if (!profile) {
          return { error: "No candidate profile found. Please upload a CV first." };
        }

        const candidateSkills = (profile.skills || []).map((s) => s.toLowerCase().trim());
        if (candidateSkills.length === 0) {
          return { error: "Candidate profile has no skills listed. Please update skills or upload a CV." };
        }

        const activeJobs = await ctx.matchJobs(candidateSkills, limit);

        const matches = activeJobs.map((job) => {
          const jobSkills = (job.requiredSkills || []).map((s) => s.toLowerCase().trim());
          
          // Calculate Jaccard Overlap
          const intersect = candidateSkills.filter((s) => jobSkills.includes(s));
          const union = Array.from(new Set([...candidateSkills, ...jobSkills]));
          const jaccard = union.length > 0 ? intersect.length / union.length : 0;

          // Normalize FTS Rank (cap at 1.0)
          const ftsRank = job.fts_rank !== undefined ? Math.min(job.fts_rank, 1.0) : 0.5;

          // Hybrid score: 0.4 FTS Rank + 0.6 Jaccard Overlap
          const score = (ftsRank * 0.4) + (jaccard * 0.6);

          return {
            jobId: job.id,
            title: job.title,
            company: job.company,
            matchScore: Number(score.toFixed(2)),
            requiredSkills: job.requiredSkills,
            workMode: job.workMode,
            salaryText: "Competitive salary with full benefits", // Redacted
            description: job.description,
          };
        });

        // Sort descending by score
        matches.sort((a, b) => b.matchScore - a.matchScore);

        return matches.slice(0, limit);

      } catch (err: any) {
        console.error("[match-candidate] execution failed:", err);
        return {
          error: err.message || String(err),
        };
      }
    },
  });
}
