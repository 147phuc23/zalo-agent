import { tool } from "ai";
import { z } from "zod";
import { OpenRouterAiClient } from "@platform/ai-client";
import { extractLocationSlugs } from "../../core/location-normalizer.js";
import type { CandidateRequirement } from "../../types.js";

const SYSTEM_PROMPT = `You are a candidate requirement normalization tool.
Your goal is to parse raw candidate preferences or query messages into a clean, structured JSON format.

You should extract and normalize these optional fields:
- role: candidate's target job role. Match it to a value in the availableOptions.roles list if provided, otherwise keep it clean and lowercase.
- skills: array of candidate's skills. Match and map to commonSkills if there's a close match.
- locationSlugs: array of locations mentioned.
- workMode: "remote" | "hybrid" | "onsite"
- salaryMinVnd: expected minimum salary in Vietnamese Dong (VND). IMPORTANT: if the candidate specifies their salary expectation in USD (e.g., $2000, 2k net, 2k usd), you MUST convert it to VND by multiplying by 25,000 (e.g., 2,000 USD is 50,000,000 VND). Never output raw USD.
- yearsOfExperience: number of years of experience.
- availability: "immediate" | "2_weeks" | "1_month" | "negotiable".
- language: "english" | "vietnamese".

You must respond ONLY with a JSON object. No other text or markdown formatting.`;

export function createNormalizeRequirementTool() {
  return tool({
    description: "Normalize raw user messages or text queries into structured CandidateRequirement fields.",
    parameters: z.object({
      rawText: z.string().describe("The raw candidate statement or request containing job search preferences (e.g., 'React developer hybrid in HCM, salary 2k USD')."),
      availableOptions: z.object({
        locations: z.array(z.string()).optional(),
        roles: z.array(z.string()).optional(),
        workModes: z.array(z.string()).optional(),
        commonSkills: z.array(z.string()).optional(),
      }).optional().describe("Dynamic option lists loaded from the load job filters skill to guide LLM taxonomy mapping."),
    }),
    execute: async ({ rawText, availableOptions }) => {
      const client = new OpenRouterAiClient();
      const model = "tencent/hy3:free"; // default fallback free model
      
      let prompt = `Normalize this candidate input: "${rawText}"`;
      if (availableOptions) {
        prompt = `Available options for matching:\n${JSON.stringify(availableOptions)}\n\n${prompt}`;
      }

      const response = await client.generate({
        model,
        system: SYSTEM_PROMPT,
        prompt,
        temperature: 0.1,
        responseFormat: { type: "json_object" },
      });

      let extracted: CandidateRequirement = {};
      try {
        const parsed = JSON.parse(response.text.trim());
        extracted = parsed as CandidateRequirement;
      } catch (err) {
        console.error("[normalize-requirement] Failed to parse JSON response:", response.text, err);
      }

      // Safe checks and defensive mapping
      const requirement: CandidateRequirement = {};

      if (typeof extracted.role === "string" && extracted.role.trim()) {
        requirement.role = extracted.role.trim().toLowerCase();
      }

      if (Array.isArray(extracted.skills)) {
        requirement.skills = extracted.skills
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim().toLowerCase());
      }

      // Re-derive location slugs defensively from raw text, or match LLM output slugs
      const derivedSlugs = extractLocationSlugs(rawText);
      if (derivedSlugs.length > 0) {
        requirement.locationSlugs = derivedSlugs;
      } else if (Array.isArray(extracted.locationSlugs)) {
        requirement.locationSlugs = extracted.locationSlugs
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim().toLowerCase());
      }

      if (extracted.workMode === "remote" || extracted.workMode === "hybrid" || extracted.workMode === "onsite") {
        requirement.workMode = extracted.workMode;
      }

      if (typeof extracted.salaryMinVnd === "number" && extracted.salaryMinVnd > 0) {
        requirement.salaryMinVnd = extracted.salaryMinVnd;
      }

      if (typeof extracted.yearsOfExperience === "number" && extracted.yearsOfExperience >= 0) {
        requirement.yearsOfExperience = extracted.yearsOfExperience;
      }

      if (extracted.availability === "immediate" || extracted.availability === "2_weeks" || extracted.availability === "1_month" || extracted.availability === "negotiable") {
        requirement.availability = extracted.availability;
      }

      if (extracted.language === "english" || extracted.language === "vietnamese") {
        requirement.language = extracted.language;
      }

      return { requirement };
    },
  });
}
