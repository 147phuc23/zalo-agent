import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { CANONICAL_LOCATIONS } from "@platform/shared/locations";
import { createDatabaseClient } from "./index.js";
import { createJobPostingRepository, createTenantRepository } from "./repositories.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config();

const TENANT_ID = "b545a6ca-eabe-4bb8-852d-2c497edb8e38";

function extractLocationSlugs(text: string): string[] {
  if (!text) return [];
  const textLower = text.toLowerCase();
  const found: string[] = [];
  for (const loc of CANONICAL_LOCATIONS) {
    const alternatives = [loc.englishName, loc.vietnameseName, ...loc.aliases].map((x) => x.toLowerCase());
    if (alternatives.some((alt) => textLower.includes(alt))) {
      found.push(loc.slug);
    }
  }
  return found;
}

// Simple parser for sql INSERT statement format in jobs_insert.sql
function parseSqlFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const blocks = content.split(/INSERT INTO public\.job_postings/i).slice(1);
  const jobs: any[] = [];

  for (const block of blocks) {
    const valuesMatch = block.match(/VALUES\s*\(([\s\S]*?)\)\s*ON CONFLICT/i);
    if (!valuesMatch) continue;

    const lines = valuesMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 15) continue;

    // Helper to clean quotes and commas
    const cleanString = (val: string) => {
      const trimmed = val.trim().replace(/,$/, "").trim();
      if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1).replace(/''/g, "'");
      }
      return trimmed === "NULL" ? null : trimmed;
    };

    const cleanNumber = (val: string) => {
      const cleaned = cleanString(val);
      return cleaned ? Number(cleaned) : 0;
    };

    const cleanArray = (val: string) => {
      const cleaned = cleanString(val);
      if (!cleaned) return [];
      // Format is {"Java","AWS"}
      const match = cleaned.match(/^\{(.*)\}$/);
      if (!match) return [];
      return match[1]
        .split(",")
        .map((s) => s.replace(/^"|"$/g, "").replace(/\\"/g, '"').trim())
        .filter(Boolean);
    };

    const externalId = cleanString(lines[1]);
    const title = cleanString(lines[2]) || "Untitled";
    const company = cleanString(lines[3]) || "Unknown";
    const rawLocation = cleanString(lines[4]) || "";
    const workMode = (cleanString(lines[5]) || "hybrid") as "remote" | "hybrid" | "onsite";
    const salaryMinVnd = cleanNumber(lines[6]);
    const salaryMaxVnd = cleanNumber(lines[7]);
    const seniority = cleanString(lines[8]) || "mid";
    const requiredSkills = cleanArray(lines[9]);
    const description = cleanString(lines[10]) || "";
    const jobType = cleanString(lines[11]);
    const experienceRequiredYears = lines[12] ? (cleanString(lines[12]) ? Number(cleanString(lines[12])) : null) : null;
    const benefits = cleanString(lines[13]);
    const educationRequired = cleanString(lines[14]);

    const locationSlugs = extractLocationSlugs(rawLocation);

    jobs.push({
      externalId,
      title,
      company,
      locationSlugs,
      workMode,
      salaryMinVnd,
      salaryMaxVnd,
      seniority,
      requiredSkills,
      description,
      jobType,
      experienceRequiredYears,
      benefits,
      educationRequired,
    });
  }

  return jobs;
}

async function main() {
  const sqlPath = path.resolve(__dirname, "../../../jobs_insert.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error(`jobs_insert.sql not found at ${sqlPath}`);
    process.exit(1);
  }

  console.log(`Parsing jobs from ${sqlPath}...`);
  const jobsToSeed = parseSqlFile(sqlPath);
  console.log(`Found ${jobsToSeed.length} jobs to seed.`);

  const url = process.env.PLATFORM_DB_URL;
  if (!url) {
    console.error("PLATFORM_DB_URL is not set");
    process.exit(1);
  }

  const client = createDatabaseClient({ PLATFORM_DB_URL: url });
  const tenants = createTenantRepository(client);
  const jobsRepo = createJobPostingRepository(client);

  // Ensure tenant exists
  await tenants.ensureExists({
    tenantId: TENANT_ID,
    name: `tenant-${TENANT_ID.slice(0, 8)}`,
    timezone: "Asia/Ho_Chi_Minh",
    locale: "vi-VN",
  });

  const { inserted } = await jobsRepo.bulkInsert({
    tenantId: TENANT_ID,
    jobs: jobsToSeed,
  });

  await client.end();
  console.log(`[seed-jobs-from-sql] upserted ${inserted} jobs directly to Neon database.`);
}

main().catch((err) => {
  console.error("Failed to seed jobs from sql:", err);
  process.exit(1);
});
