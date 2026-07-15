import { tool } from "ai";
import { z } from "zod";
import { mockCompanies, type CompanyDetail } from "./mock-data.js";

export interface QueryCompanyContext {
  getCompany?: (name: string) => Promise<CompanyDetail | null>;
}

export function createQueryCompanyTool(ctx?: QueryCompanyContext) {
  return tool({
    description: "Query detailed company profile information (introduction, benefits, work style) by company name.",
    parameters: z.object({
      name: z.string().describe("Exact or partial name of the company to query details for."),
    }),
    execute: async ({ name }) => {
      if (ctx?.getCompany) {
        try {
          const fromDb = await ctx.getCompany(name);
          if (fromDb) return fromDb;
        } catch (err) {
          console.error("[query-company] DB lookup failed, falling back to mock:", err);
        }
      }

      // Fallback to mock data matching name (case-insensitive fuzzy match)
      const lowercaseName = name.toLowerCase();
      const matched = mockCompanies.find((c) =>
        c.name.toLowerCase().includes(lowercaseName)
      );

      if (matched) {
        return matched;
      }

      return {
        error: `Company "${name}" not found.`,
      };
    },
  });
}
