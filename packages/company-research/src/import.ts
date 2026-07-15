import fs from "fs";
import { createDatabaseClient, createRepositorySet } from "@platform/database";
import { CompanyResearchJsonSchema } from "./schema.js";

export async function importCompanyResearch(input: {
  tenantId: string;
  filePath: string;
  answerGapId?: string;
  answerText?: string;
}) {
  const dbUrl = process.env.PLATFORM_DB_URL;
  if (!dbUrl) throw new Error("PLATFORM_DB_URL is required to import");

  console.log(`[import] Reading profile from ${input.filePath}...`);
  const raw = fs.readFileSync(input.filePath, "utf-8");
  const data = CompanyResearchJsonSchema.parse(JSON.parse(raw));

  const client = createDatabaseClient({ PLATFORM_DB_URL: dbUrl });
  const repos = createRepositorySet(client);

  try {
    console.log(`[import] Importing research for "${data.name}"...`);
    const company = await repos.companies.updateResearch({
      tenantId: input.tenantId,
      name: data.name,
      website: data.website,
      introduction: data.introduction,
      benefits: data.benefits,
      workStyle: data.workStyle,
      leadership: data.leadership,
      products: data.products,
      materials: data.materials,
      research: data.research,
    });

    console.log(`[import] Saved company details (ID: ${company.id})`);

    // Import sources if logged in research.sources
    const sources = (data.research?.sources as any[]) || [];
    if (sources.length > 0) {
      console.log(`[import] Saving ${sources.length} crawled sources...`);
      await repos.companySources.replaceForCompany({
        tenantId: input.tenantId,
        companyId: company.id,
        sources: sources.map((s) => ({
          url: s.url,
          kind: s.kind || "other",
          title: s.title || null,
          contentExcerpt: s.contentExcerpt || null,
          fetchedAt: s.fetchedAt || null,
        })),
      });
    }

    // Answer gap if specified
    if (input.answerGapId && input.answerText) {
      console.log(`[import] Answering gap ${input.answerGapId}...`);
      await repos.knowledgeGaps.markAnswered({
        id: input.answerGapId,
        answer: input.answerText,
      });
      console.log("[import] Gap marked as answered!");
    }

    // Print remaining open gaps for this company
    const openGaps = await repos.knowledgeGaps.listOpen({
      tenantId: input.tenantId,
      companyId: company.id,
    });

    if (openGaps.length > 0) {
      console.log(`\n[import] Remaining Open Knowledge Gaps for "${data.name}":`);
      for (const gap of openGaps) {
        console.log(`- [${gap.id}] Topic: ${gap.topic} (Asked ${gap.ask_count}x)`);
        console.log(`  Question: "${gap.question}"`);
      }
    } else {
      console.log(`\n[import] No remaining open knowledge gaps for "${data.name}".`);
    }

  } finally {
    await client.end();
  }
}
