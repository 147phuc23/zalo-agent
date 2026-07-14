import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_LOCATIONS } from "@platform/shared/locations";
import { createDatabaseClient } from "./index.js";
import { createTenantRepository, createJobPostingRepository } from "./repositories.js";

// Load .env.local from repo root (same as the migrate CLI).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config();

const TENANT_ID = process.env.TENANT_ID ?? "11111111-1111-1111-1111-111111111111";
const JOB_COUNT = Number(process.env.JOB_COUNT ?? 100);

const ROLES = [
  {
    title: "Frontend Engineer",
    skills: ["React", "TypeScript", "Next.js", "TailwindCSS"],
  },
  { title: "Backend Engineer", skills: ["Node.js", "NestJS", "PostgreSQL", "Redis"] },
  { title: "AI Engineer", skills: ["Python", "LLM", "SQL", "RAG"] },
  { title: "Fullstack Engineer", skills: ["React", "Node.js", "GraphQL", "AWS"] },
  { title: "DevOps Engineer", skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"] },
  { title: "Data Engineer", skills: ["Python", "Spark", "Airflow", "SQL"] },
  { title: "Mobile Engineer", skills: ["React Native", "Swift", "Kotlin"] },
  { title: "QA Engineer", skills: ["Playwright", "Cypress", "Jest"] },
  { title: "Product Designer", skills: ["Figma", "Prototyping", "Design Systems"] },
  { title: "Engineering Manager", skills: ["Leadership", "System Design", "Agile"] },
];
const COMPANIES = [
  "Atlas Product Studio",
  "Northstar HR Cloud",
  "Signal Recruit",
  "VietTech Labs",
  "Saigon Digital",
  "Hanoi Cloud",
  "Mekong AI",
  "FPT Software",
  "Tiki Engineering",
  "VNG Studio",
];
const LOCATIONS = CANONICAL_LOCATIONS.map((loc) => ({
  display: loc.englishName,
  slug: loc.slug,
}));
const WORK_MODES = ["remote", "hybrid", "onsite"] as const;
const SENIORITIES = ["junior", "mid", "mid-senior", "senior", "lead"];
const JOB_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"] as const;

function generateJobs(count: number) {
  const jobs = [];
  for (let i = 0; i < count; i++) {
    const role = ROLES[i % ROLES.length];
    const seniority = SENIORITIES[i % SENIORITIES.length];
    const baseSalary = 25_000_000 + (i % 8) * 7_000_000;
    const location = LOCATIONS[i % LOCATIONS.length];
    jobs.push({
      externalId: `seed-job-${String(i + 1).padStart(3, "0")}`,
      title: `${seniority === "junior" ? "Junior " : seniority === "senior" ? "Senior " : ""}${role.title}`,
      company: COMPANIES[i % COMPANIES.length],
      locationSlugs: [location.slug],
      workMode: WORK_MODES[i % WORK_MODES.length],
      salaryMinVnd: baseSalary,
      salaryMaxVnd: baseSalary + 20_000_000,
      seniority,
      requiredSkills: role.skills,
      description: `${role.title} role focused on building production systems with a collaborative team.`,
      jobType: JOB_TYPES[i % JOB_TYPES.length],
      experienceRequiredYears: (i % 8) + 1,
      benefits: "13th month salary, health insurance, hybrid flexibility",
      educationRequired: "Bachelor's degree or equivalent experience",
    });
  }
  return jobs;
}

async function main() {
  const url = process.env.PLATFORM_DB_URL;
  if (!url) {
    console.error("[seed-jobs] PLATFORM_DB_URL is not set");
    process.exit(1);
  }
  const client = createDatabaseClient({ PLATFORM_DB_URL: url });
  const tenants = createTenantRepository(client);
  const jobs = createJobPostingRepository(client);

  await tenants.ensureExists({
    tenantId: TENANT_ID,
    name: `tenant-${TENANT_ID.slice(0, 8)}`,
    timezone: "Asia/Ho_Chi_Minh",
    locale: "vi-VN",
  });

  const generated = generateJobs(JOB_COUNT);
  const { inserted } = await jobs.bulkInsert({ tenantId: TENANT_ID, jobs: generated });
  const total = await jobs.count({ tenantId: TENANT_ID });

  await client.end();
  console.log(
    `[seed-jobs] upserted ${inserted} jobs for tenant ${TENANT_ID} (active total: ${total})`,
  );
}

main().catch((err) => {
  console.error("[seed-jobs] failed", err);
  process.exit(1);
});
