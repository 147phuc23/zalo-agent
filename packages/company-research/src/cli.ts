#!/usr/bin/env node

import "dotenv/config";
import { runCompanyResearch } from "./research.js";
import { importCompanyResearch } from "./import.js";
import { createDatabaseClient, createRepositorySet } from "@platform/database";

const tenantId = process.env.TENANT_ID || "b545a6ca-eabe-4bb8-852d-2c497edb8e38";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printHelp();
    process.exit(1);
  }

  // Helper to parse CLI flag values
  const getFlag = (flagName: string): string | undefined => {
    const idx = args.indexOf(flagName);
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
    return undefined;
  };

  try {
    if (command === "research") {
      const name = getFlag("--name");
      const website = getFlag("--website");
      const manualTextFile = getFlag("--manual-text-file");
      const gapId = getFlag("--gap-id");

      if (!name) {
        console.error("Error: --name is required for research");
        process.exit(1);
      }

      await runCompanyResearch({ name, website, manualTextFile, gapId });

    } else if (command === "import") {
      const filePath = getFlag("--file");
      const answerGapId = getFlag("--answer-gap");
      const answerText = getFlag("--answer");
      const customTenant = getFlag("--tenant") || tenantId;

      if (!filePath) {
        console.error("Error: --file is required for import");
        process.exit(1);
      }

      await importCompanyResearch({
        tenantId: customTenant,
        filePath,
        answerGapId,
        answerText,
      });

    } else if (command === "gaps") {
      const customTenant = getFlag("--tenant") || tenantId;
      const dbUrl = process.env.PLATFORM_DB_URL;
      if (!dbUrl) throw new Error("PLATFORM_DB_URL is required to view gaps");

      const client = createDatabaseClient({ PLATFORM_DB_URL: dbUrl });
      const repos = createRepositorySet(client);

      try {
        const gaps = await repos.knowledgeGaps.listOpen({ tenantId: customTenant });
        console.log(`\nOpen Knowledge Gaps (Tenant: ${customTenant}):`);
        if (gaps.length === 0) {
          console.log("No open knowledge gaps found!");
        } else {
          for (const gap of gaps) {
            console.log(`- [${gap.id}] Topic: ${gap.topic} (Asked ${gap.ask_count}x)`);
            console.log(`  Question: "${gap.question}"`);
            if (gap.company_id) {
              const comp = await repos.companies.findById(gap.company_id);
              console.log(`  Company: ${comp?.name || "Unknown"}`);
            }
          }
        }
      } finally {
        await client.end();
      }

    } else {
      printHelp();
    }
  } catch (err: any) {
    console.error("Execution failed:", err.message || err);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Company Research CLI
Usage:
  npx tsx src/cli.ts research --name <name> [--website <url>] [--manual-text-file <path>] [--gap-id <id>]
  npx tsx src/cli.ts import --file <json-path> [--tenant <id>] [--answer-gap <id> --answer <text>]
  npx tsx src/cli.ts gaps [--tenant <id>]
`);
}

main();
