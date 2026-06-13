/**
 * Seed deterministic recruiting demo records into Twenty.
 * Creates 6 candidates, 5 job postings, and 10 applications spread across pipeline stages.
 *
 * Prerequisite: `pnpm --filter @platform/worker twenty:schema`
 *
 * Usage:
 *   pnpm --filter @platform/worker twenty:seed
 */
import { loadTwentyEnv } from "../../src/agent/twenty/twenty-env.js";
import { twentyHttpJson } from "../../src/agent/twenty/twenty-http.js";
import {
  extractCoreManyRecords,
  pickFirstRecord,
} from "../../src/agent/twenty/twenty-rest-parsers.js";
import {
  RECRUITING_JOB_APPLICATION_FIELDS,
  RECRUITING_JOB_POSTING_FIELDS,
  RECRUITING_OBJECTS,
  RECRUITING_PERSON_FIELDS,
} from "../../src/agent/twenty/recruiting-schema-constants.js";
import { loadRepoEnvLocal } from "./load-repo-env.js";

// ── Candidate seed data ────────────────────────────────────────────────────────

const CANDIDATES = [
  {
    externalUserId: "zalo-candidate-001",
    firstName: "Minh",
    lastName: "Nguyễn",
    email: "minh.nguyen@example.local",
    phone: "+84901234001",
    currentTitle: "Frontend Engineer",
    currentCompany: "Tiki Corp",
    skillsSummary: "React, TypeScript, Next.js, TailwindCSS, GraphQL",
    preferredRolesSummary: "Frontend Engineer, Full-stack Engineer",
    salaryExpectationVnd: 45_000_000,
    yearsExperience: 3,
    noticePeriodDays: 30,
    recruitingPipelineStage: "screening",
    linkedinUrl: "https://linkedin.com/in/minh-nguyen-demo",
  },
  {
    externalUserId: "zalo-candidate-002",
    firstName: "Linh",
    lastName: "Trần",
    email: "linh.tran@example.local",
    phone: "+84901234002",
    currentTitle: "Senior Backend Engineer",
    currentCompany: "VNG Corporation",
    skillsSummary: "Node.js, NestJS, PostgreSQL, Redis, Kafka, Docker",
    preferredRolesSummary: "Backend Engineer, Tech Lead",
    salaryExpectationVnd: 65_000_000,
    yearsExperience: 6,
    noticePeriodDays: 45,
    recruitingPipelineStage: "interviewing",
    linkedinUrl: "https://linkedin.com/in/linh-tran-demo",
  },
  {
    externalUserId: "zalo-candidate-003",
    firstName: "Hùng",
    lastName: "Lê",
    email: "hung.le@example.local",
    phone: "+84901234003",
    currentTitle: "AI/ML Engineer",
    currentCompany: "FPT Software",
    skillsSummary: "Python, PyTorch, LangChain, SQL, FastAPI, LLM fine-tuning",
    preferredRolesSummary: "AI Engineer, ML Engineer, Applied Scientist",
    salaryExpectationVnd: 75_000_000,
    yearsExperience: 5,
    noticePeriodDays: 30,
    recruitingPipelineStage: "new",
    linkedinUrl: "https://linkedin.com/in/hung-le-demo",
  },
  {
    externalUserId: "zalo-candidate-004",
    firstName: "Phương",
    lastName: "Phạm",
    email: "phuong.pham@example.local",
    phone: "+84901234004",
    currentTitle: "Product Manager",
    currentCompany: "Grab Vietnam",
    skillsSummary: "Product strategy, User research, SQL, Figma, Agile",
    preferredRolesSummary: "Product Manager, Product Owner",
    salaryExpectationVnd: 55_000_000,
    yearsExperience: 4,
    noticePeriodDays: 60,
    recruitingPipelineStage: "screening",
    linkedinUrl: "https://linkedin.com/in/phuong-pham-demo",
  },
  {
    externalUserId: "zalo-candidate-005",
    firstName: "Đức",
    lastName: "Vũ",
    email: "duc.vu@example.local",
    phone: "+84901234005",
    currentTitle: "DevOps Engineer",
    currentCompany: "Freelance",
    skillsSummary: "Kubernetes, Terraform, AWS, CI/CD, Prometheus, Grafana",
    preferredRolesSummary: "DevOps Engineer, Platform Engineer, SRE",
    salaryExpectationVnd: 60_000_000,
    yearsExperience: 4,
    noticePeriodDays: 14,
    recruitingPipelineStage: "new",
    linkedinUrl: "https://linkedin.com/in/duc-vu-demo",
  },
  {
    externalUserId: "zalo-candidate-006",
    firstName: "Anh",
    lastName: "Ngô",
    email: "anh.ngo@example.local",
    phone: "+84901234006",
    currentTitle: "Full-stack Engineer",
    currentCompany: "Momo",
    skillsSummary: "React, Node.js, Go, PostgreSQL, Redis, Docker",
    preferredRolesSummary: "Full-stack Engineer, Backend Engineer",
    salaryExpectationVnd: 52_000_000,
    yearsExperience: 4,
    noticePeriodDays: 30,
    recruitingPipelineStage: "placed",
    linkedinUrl: "https://linkedin.com/in/anh-ngo-demo",
  },
] as const;

// ── Job posting seed data ──────────────────────────────────────────────────────

const JOB_POSTINGS = [
  {
    name: "Senior Frontend Engineer",
    companyName: "Atlas Product Studio",
    location: "Ho Chi Minh City",
    workMode: "hybrid",
    salaryMinVnd: 40_000_000,
    salaryMaxVnd: 60_000_000,
    seniority: "senior",
    department: "Engineering",
    headcount: 2,
    status: "open",
    requiredSkills: "React, TypeScript, Next.js, GraphQL",
    description:
      "Own the frontend of our SaaS platform serving 50k+ SMBs. Work closely with product and design to ship high-quality customer-facing features. Tech: React, TypeScript, Next.js, GraphQL.",
  },
  {
    name: "Backend Engineer (NestJS)",
    companyName: "Northstar HR Cloud",
    location: "Ha Noi",
    workMode: "onsite",
    salaryMinVnd: 45_000_000,
    salaryMaxVnd: 70_000_000,
    seniority: "mid-senior",
    department: "Engineering",
    headcount: 1,
    status: "open",
    requiredSkills: "Node.js, NestJS, PostgreSQL, Redis",
    description:
      "Build multi-tenant HR SaaS backend: REST + GraphQL APIs, BullMQ job workers, PostgreSQL schema design, and Kafka event streaming.",
  },
  {
    name: "AI/ML Engineer",
    companyName: "Signal Recruit",
    location: "Ho Chi Minh City",
    workMode: "remote",
    salaryMinVnd: 60_000_000,
    salaryMaxVnd: 90_000_000,
    seniority: "mid-senior",
    department: "AI & Data",
    headcount: 2,
    status: "open",
    requiredSkills: "Python, LLM, PyTorch, SQL, FastAPI",
    description:
      "Design and evaluate AI recruiter pipelines: RAG for job matching, LLM-based screening workflows, and feedback loop tooling. Python-first stack with FastAPI services.",
  },
  {
    name: "Product Manager — Fintech",
    companyName: "Kredivo Vietnam",
    location: "Ho Chi Minh City",
    workMode: "hybrid",
    salaryMinVnd: 50_000_000,
    salaryMaxVnd: 75_000_000,
    seniority: "mid",
    department: "Product",
    headcount: 1,
    status: "open",
    requiredSkills: "Product strategy, SQL, Fintech, Agile, User research",
    description:
      "Drive roadmap for our buy-now-pay-later core product. Own discovery, prioritization, and cross-functional delivery with eng and data science.",
  },
  {
    name: "Platform / DevOps Engineer",
    companyName: "Coin68 Labs",
    location: "Remote",
    workMode: "remote",
    salaryMinVnd: 55_000_000,
    salaryMaxVnd: 80_000_000,
    seniority: "mid-senior",
    department: "Infrastructure",
    headcount: 1,
    status: "open",
    requiredSkills: "Kubernetes, Terraform, AWS, CI/CD, Prometheus",
    description:
      "Own infrastructure for a crypto data platform on AWS/EKS. Build GitOps pipelines, observability stacks, and cost-optimization tooling.",
  },
] as const;

// ── Application links [candidateIndex, jobIndex, stage, matchScore] ───────────

const APPLICATIONS: Array<{
  candidateExternalId: string;
  jobName: string;
  pipelineStage: string;
  matchScore: number;
}> = [
  // Minh (Frontend) → Frontend Engineer role (great match)
  { candidateExternalId: "zalo-candidate-001", jobName: "Senior Frontend Engineer", pipelineStage: "screening", matchScore: 88 },
  // Minh also applied to Backend (weaker match)
  { candidateExternalId: "zalo-candidate-001", jobName: "Backend Engineer (NestJS)", pipelineStage: "applied", matchScore: 52 },
  // Linh (Backend) → Backend Engineer (strong match, in interview)
  { candidateExternalId: "zalo-candidate-002", jobName: "Backend Engineer (NestJS)", pipelineStage: "interview", matchScore: 91 },
  // Linh also applied to Frontend (lower match)
  { candidateExternalId: "zalo-candidate-002", jobName: "Senior Frontend Engineer", pipelineStage: "applied", matchScore: 58 },
  // Hùng (AI) → AI Engineer (strong match)
  { candidateExternalId: "zalo-candidate-003", jobName: "AI/ML Engineer", pipelineStage: "screening", matchScore: 93 },
  // Phương (PM) → PM Fintech (strong match)
  { candidateExternalId: "zalo-candidate-004", jobName: "Product Manager — Fintech", pipelineStage: "interview", matchScore: 85 },
  // Đức (DevOps) → Platform Engineer (strong match)
  { candidateExternalId: "zalo-candidate-005", jobName: "Platform / DevOps Engineer", pipelineStage: "screening", matchScore: 90 },
  // Đức also applied to Backend (weaker)
  { candidateExternalId: "zalo-candidate-005", jobName: "Backend Engineer (NestJS)", pipelineStage: "applied", matchScore: 45 },
  // Anh (Fullstack) → Frontend (good match)
  { candidateExternalId: "zalo-candidate-006", jobName: "Senior Frontend Engineer", pipelineStage: "offer", matchScore: 79 },
  // Anh → Backend (good match too)
  { candidateExternalId: "zalo-candidate-006", jobName: "Backend Engineer (NestJS)", pipelineStage: "rejected", matchScore: 71 },
];

// ── Main ───────────────────────────────────────────────────────────────────────

export async function seedRecruitingDemoData() {
  const env = loadTwentyEnv();
  const baseUrl = env.TWENTY_BASE_URL;
  const apiKey = env.TWENTY_API_KEY;

  // ── People ──────────────────────────────────────────────────────────────────
  console.log("[twenty:seed] Seeding candidates…");

  for (const candidate of CANDIDATES) {
    const existing = await findPersonByExternalId(baseUrl, apiKey, candidate.externalUserId);
    if (existing?.id) {
      console.log(`[twenty:seed] Candidate exists: ${candidate.firstName} ${candidate.lastName}`);
      continue;
    }

    await twentyHttpJson({
      baseUrl,
      apiKey,
      request: {
        path: "/rest/people",
        method: "POST",
        body: {
          name: { firstName: candidate.firstName, lastName: candidate.lastName },
          emails: { primaryEmail: candidate.email, additionalEmails: [] },
          phones: { primaryPhoneNumber: candidate.phone, primaryPhoneCountryCode: "+84", additionalPhones: [] },
          [RECRUITING_PERSON_FIELDS.externalUserId]: candidate.externalUserId,
          [RECRUITING_PERSON_FIELDS.recruitingPipelineStage]: candidate.recruitingPipelineStage,
          [RECRUITING_PERSON_FIELDS.skillsSummary]: candidate.skillsSummary,
          [RECRUITING_PERSON_FIELDS.preferredRolesSummary]: candidate.preferredRolesSummary,
          [RECRUITING_PERSON_FIELDS.salaryExpectationVnd]: candidate.salaryExpectationVnd,
          [RECRUITING_PERSON_FIELDS.yearsExperience]: candidate.yearsExperience,
          [RECRUITING_PERSON_FIELDS.currentTitle]: candidate.currentTitle,
          [RECRUITING_PERSON_FIELDS.currentCompany]: candidate.currentCompany,
          [RECRUITING_PERSON_FIELDS.noticePeriodDays]: candidate.noticePeriodDays,
          [RECRUITING_PERSON_FIELDS.linkedinUrl]: candidate.linkedinUrl,
        },
      },
    });

    console.log(`[twenty:seed] Created candidate: ${candidate.firstName} ${candidate.lastName}`);
  }

  // ── Job postings ─────────────────────────────────────────────────────────────
  console.log("[twenty:seed] Seeding job postings…");

  const jobIds: Record<string, string> = {};

  for (const job of JOB_POSTINGS) {
    const existing = await findJobPostingByName(baseUrl, apiKey, job.name);
    if (existing?.id) {
      jobIds[job.name] = String(existing.id);
      console.log(`[twenty:seed] Job posting exists: ${job.name}`);
      continue;
    }

    const created = await twentyHttpJson<unknown>({
      baseUrl,
      apiKey,
      request: {
        path: `/rest/${RECRUITING_OBJECTS.jobPosting.namePlural}`,
        method: "POST",
        body: {
          name: job.name,
          [RECRUITING_JOB_POSTING_FIELDS.companyName]: job.companyName,
          [RECRUITING_JOB_POSTING_FIELDS.location]: job.location,
          [RECRUITING_JOB_POSTING_FIELDS.workMode]: job.workMode,
          [RECRUITING_JOB_POSTING_FIELDS.salaryMinVnd]: job.salaryMinVnd,
          [RECRUITING_JOB_POSTING_FIELDS.salaryMaxVnd]: job.salaryMaxVnd,
          [RECRUITING_JOB_POSTING_FIELDS.seniority]: job.seniority,
          [RECRUITING_JOB_POSTING_FIELDS.department]: job.department,
          [RECRUITING_JOB_POSTING_FIELDS.headcount]: job.headcount,
          [RECRUITING_JOB_POSTING_FIELDS.status]: job.status,
          [RECRUITING_JOB_POSTING_FIELDS.requiredSkills]: job.requiredSkills,
          [RECRUITING_JOB_POSTING_FIELDS.description]: job.description,
        },
      },
    });

    const row = extractSingularRecord(created);
    const id = row?.id ? String(row.id) : "";
    if (!id) throw new Error(`[twenty:seed] Unexpected jobPosting response: ${JSON.stringify(created)}`);

    jobIds[job.name] = id;
    console.log(`[twenty:seed] Created job posting: ${job.name} (${id})`);
  }

  // ── Applications ─────────────────────────────────────────────────────────────
  console.log("[twenty:seed] Seeding applications…");

  for (const app of APPLICATIONS) {
    const jobPostingRecordId = jobIds[app.jobName];
    if (!jobPostingRecordId) {
      console.warn(`[twenty:seed] Job id not found for "${app.jobName}", skipping application.`);
      continue;
    }

    const existing = await findApplication(baseUrl, apiKey, {
      candidateExternalId: app.candidateExternalId,
      jobPostingRecordId,
    });

    if (existing) {
      console.log(`[twenty:seed] Application exists: ${app.candidateExternalId} → ${app.jobName}`);
      continue;
    }

    await twentyHttpJson({
      baseUrl,
      apiKey,
      request: {
        path: `/rest/${RECRUITING_OBJECTS.jobApplication.namePlural}`,
        method: "POST",
        body: {
          [RECRUITING_JOB_APPLICATION_FIELDS.candidateExternalId]: app.candidateExternalId,
          [RECRUITING_JOB_APPLICATION_FIELDS.jobPostingRecordId]: jobPostingRecordId,
          [RECRUITING_JOB_APPLICATION_FIELDS.pipelineStage]: app.pipelineStage,
          [RECRUITING_JOB_APPLICATION_FIELDS.matchScore]: app.matchScore,
        },
      },
    });

    console.log(`[twenty:seed] Created application: ${app.candidateExternalId} → ${app.jobName} (${app.pipelineStage}, score: ${app.matchScore})`);
  }

  console.log("[twenty:seed] Done.");
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function findPersonByExternalId(baseUrl: string, apiKey: string, externalUserId: string) {
  const payload = await twentyHttpJson<unknown>({
    baseUrl,
    apiKey,
    request: {
      path: "/rest/people",
      method: "GET",
      query: {
        filter: `${RECRUITING_PERSON_FIELDS.externalUserId}[eq]:${externalUserId}`,
        limit: "5",
      },
    },
  });
  return pickFirstRecord(payload);
}

async function findJobPostingByName(baseUrl: string, apiKey: string, name: string) {
  const payload = await twentyHttpJson<unknown>({
    baseUrl,
    apiKey,
    request: {
      path: `/rest/${RECRUITING_OBJECTS.jobPosting.namePlural}`,
      method: "GET",
      query: { filter: `name[eq]:${name}`, limit: "5" },
    },
  });
  return pickFirstRecord(payload);
}

async function findApplication(
  baseUrl: string,
  apiKey: string,
  input: { candidateExternalId: string; jobPostingRecordId: string },
) {
  const payload = await twentyHttpJson<unknown>({
    baseUrl,
    apiKey,
    request: {
      path: `/rest/${RECRUITING_OBJECTS.jobApplication.namePlural}`,
      method: "GET",
      query: {
        filter: `and(${RECRUITING_JOB_APPLICATION_FIELDS.candidateExternalId}[eq]:${input.candidateExternalId},${RECRUITING_JOB_APPLICATION_FIELDS.jobPostingRecordId}[eq]:${input.jobPostingRecordId})`,
        limit: "5",
      },
    },
  });
  const rows = extractCoreManyRecords(payload);
  const first = rows[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

function extractSingularRecord(payload: unknown): Record<string, unknown> | null {
  const data = (payload as { data?: Record<string, unknown> }).data;
  if (!data || typeof data !== "object") return null;
  for (const value of Object.values(data)) {
    if (!value || Array.isArray(value)) continue;
    if (typeof value === "object") return value as Record<string, unknown>;
  }
  return null;
}

loadRepoEnvLocal();

seedRecruitingDemoData().catch((error) => {
  console.error("[twenty:seed] Failed:", error);
  process.exitCode = 1;
});
