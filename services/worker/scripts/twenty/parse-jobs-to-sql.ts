import fs from "node:fs";
import path from "node:path";
import { OpenRouterAiClient } from "@platform/ai-client";
import { CANONICAL_LOCATIONS, extractLocationSlugs } from "@platform/agent/location-normalizer";
import { loadRepoEnvLocal } from "./load-repo-env.js";

// Make sure repo env is loaded
const { repoRoot } = loadRepoEnvLocal();

const JOBS_DIR = path.join(repoRoot, "jobs_txt");
const OUTPUT_SQL_PATH = path.join(repoRoot, "jobs_insert.sql");
const TENANT_ID = process.env.TENANT_ID || "b545a6ca-eabe-4bb8-852d-2c497edb8e38";
const MODEL = process.env.HR_AGENT_MODEL || "tencent/hy3:free";

const LOCATION_SLUG_LIST = CANONICAL_LOCATIONS.map(
  (loc) => `"${loc.slug}" (${loc.englishName} / ${loc.vietnameseName})`,
).join(", ");

const SYSTEM_PROMPT = `You are an expert system that extracts structured job postings from raw text files.
You MUST output a valid JSON object matching the following structure:
{
  "title": "Job Title",
  "company": "Company Name",
  "locationSlugs": ["slug1", "slug2"], // One or more of: ${LOCATION_SLUG_LIST}. Use every slug the posting mentions (e.g. a listing open to both Ho Chi Minh City and remote gets both). If the posting's city isn't one of these, use an empty array.
  "workMode": "remote" | "hybrid" | "onsite",
  "salaryMinVnd": number, // Minimum salary in VND. If negotiable or not mentioned, use 0. If in USD, convert to VND (1 USD = 25000 VND).
  "salaryMaxVnd": number, // Maximum salary in VND. If negotiable or not mentioned, use 0. If in USD, convert to VND (1 USD = 25000 VND).
  "seniority": "junior" | "mid" | "mid-senior" | "senior" | "lead" | "principal",
  "requiredSkills": ["Skill 1", "Skill 2"], // Array of technical skills, languages, frameworks
  "description": "Short summary of responsibilities",
  "jobType": "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP",
  "experienceRequiredYears": number | null, // e.g. 3, or null if not specified
  "benefits": "Short summary of benefits (e.g. 13th month salary, health care)",
  "educationRequired": "Education requirement or null"
}

Ensure your response is ONLY the JSON object. Do not include markdown codeblocks or other formatting.`;

interface ExtractedJob {
  title: string;
  company: string;
  locationSlugs: string[];
  workMode: "remote" | "hybrid" | "onsite";
  salaryMinVnd: number;
  salaryMaxVnd: number;
  seniority: "junior" | "mid" | "mid-senior" | "senior" | "lead" | "principal";
  requiredSkills: string[];
  description: string;
  jobType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  experienceRequiredYears: number | null;
  benefits: string | null;
  educationRequired: string | null;
}

const VALID_LOCATION_SLUGS = new Set(CANONICAL_LOCATIONS.map((loc) => loc.slug));

/** Never trust the LLM's slugs literally — re-derive them from the posting text so a
 * hallucinated or misspelled slug can't silently corrupt job_postings.location_slugs. */
function resolveLocationSlugs(job: { locationSlugs?: unknown; location?: unknown }, sourceText: string): string[] {
  const claimed = Array.isArray(job.locationSlugs)
    ? job.locationSlugs.filter((s): s is string => typeof s === "string" && VALID_LOCATION_SLUGS.has(s))
    : [];
  if (claimed.length > 0) return Array.from(new Set(claimed));
  const fallbackText = typeof job.location === "string" ? job.location : sourceText;
  return extractLocationSlugs(fallbackText);
}

function escapeSqlString(val: string | null | undefined): string {
  if (val === null || val === undefined) return "NULL";
  return `'${val.replace(/'/g, "''")}'`;
}

function formatSqlArray(arr: string[]): string {
  const escaped = arr.map((x) => x.replace(/'/g, "''").replace(/"/g, '\\"'));
  return `'{"${escaped.join('","')}"}'`;
}

async function main() {
  console.log(`Starting parallel parsing of job description text files...`);
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log(`Model: ${MODEL}`);

  if (!fs.existsSync(JOBS_DIR)) {
    console.error(`Error: jobs_txt directory does not exist at ${JOBS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(JOBS_DIR).filter((f) => f.endsWith(".txt"));
  if (files.length === 0) {
    console.log("No text files found to parse.");
    return;
  }

  console.log(`Found ${files.length} files to parse. Running in parallel...`);

  const client = new OpenRouterAiClient();

  const promises = files.map(async (file) => {
    const filePath = path.join(JOBS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");

    const externalId = path.basename(file, ".txt");

    try {
      const response = await client.generate({
        model: MODEL,
        system: SYSTEM_PROMPT,
        prompt: `Extract job details from this job posting text:\n\n${content}`,
        temperature: 0.1,
        responseFormat: { type: "json_object" },
      });

      let jsonText = response.text.trim();
      // Clean up markdown block if the model outputted it
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
      }

      const jobData = JSON.parse(jsonText) as ExtractedJob;
      jobData.locationSlugs = resolveLocationSlugs(jobData, content);

      return {
        externalId,
        success: true,
        data: jobData,
      };
    } catch (err) {
      console.error(`[Error] Failed to parse file ${file}:`, err);
      return {
        externalId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const results = await Promise.all(promises);

  const sqlStatements: string[] = [];
  sqlStatements.push(`-- Migration/Seed to insert parsed job postings from jobs/ folder`);
  sqlStatements.push(`-- Target Tenant: ${TENANT_ID}\n`);

  let successCount = 0;
  for (const r of results) {
    if (!r.success || !r.data) {
      sqlStatements.push(`-- FAILED TO PARSE JOB FOR FILE: ${r.externalId} (Error: ${r.error})\n`);
      continue;
    }

    const j = r.data;
    const stmt = `INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location_slugs, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, is_active
) VALUES (
  '${TENANT_ID}',
  ${escapeSqlString(r.externalId)},
  ${escapeSqlString(j.title)},
  ${escapeSqlString(j.company)},
  ${j.locationSlugs.length > 0 ? formatSqlArray(j.locationSlugs) : "'{}'"},
  '${j.workMode || "hybrid"}',
  ${j.salaryMinVnd || 0},
  ${j.salaryMaxVnd || 0},
  '${j.seniority || "mid"}',
  ${j.requiredSkills && j.requiredSkills.length > 0 ? formatSqlArray(j.requiredSkills) : "'{}'"},
  ${escapeSqlString(j.description)},
  ${escapeSqlString(j.jobType || "FULL_TIME")},
  ${j.experienceRequiredYears !== null && j.experienceRequiredYears !== undefined ? j.experienceRequiredYears : "NULL"},
  ${escapeSqlString(j.benefits)},
  ${escapeSqlString(j.educationRequired)},
  true
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location_slugs = EXCLUDED.location_slugs,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  is_active = true;
`;
    sqlStatements.push(stmt);
    successCount++;
  }

  fs.writeFileSync(OUTPUT_SQL_PATH, sqlStatements.join("\n"));
  console.log(`\nSuccessfully processed ${successCount}/${files.length} jobs.`);
  console.log(`SQL commands written to: ${OUTPUT_SQL_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error in parser script:", err);
  process.exit(1);
});
