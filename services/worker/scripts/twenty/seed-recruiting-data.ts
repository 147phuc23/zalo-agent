/**
 * Seed deterministic recruiting demo records into Twenty (Person, jobPosting, jobApplication).
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

const DEMO_EXTERNAL_USER_ID = "zalo-candidate-frontend";

export async function seedRecruitingDemoData() {
  const env = loadTwentyEnv();
  const baseUrl = env.TWENTY_BASE_URL;
  const apiKey = env.TWENTY_API_KEY;

  console.log("[twenty:seed] Ensuring demo Person…");

  const existingPerson = await findPersonByExternalId(baseUrl, apiKey, DEMO_EXTERNAL_USER_ID);
  let personId: string;

  if (existingPerson?.id) {
    personId = String(existingPerson.id);
    console.log(`[twenty:seed] Person already exists (${personId}).`);
  } else {
    const created = await twentyHttpJson<unknown>({
      baseUrl,
      apiKey,
      request: {
        path: "/rest/people",
        method: "POST",
        body: {
          name: {
            firstName: "Minh",
            lastName: "Nguyen",
          },
          emails: {
            primaryEmail: "minh.nguyen@example.local",
            additionalEmails: [],
          },
          [RECRUITING_PERSON_FIELDS.externalUserId]: DEMO_EXTERNAL_USER_ID,
          [RECRUITING_PERSON_FIELDS.recruitingPipelineStage]: "screening",
          [RECRUITING_PERSON_FIELDS.skillsSummary]: "React, TypeScript, Next.js",
          [RECRUITING_PERSON_FIELDS.preferredRolesSummary]: "Frontend Engineer, Full-stack Engineer",
          [RECRUITING_PERSON_FIELDS.salaryExpectationVnd]: 45_000_000,
          [RECRUITING_PERSON_FIELDS.yearsExperience]: 3,
        },
      },
    });

    const row = extractSingularRecord(created);
    personId = row?.id ? String(row.id) : "";
    if (!personId) {
      throw new Error(`[twenty:seed] Unexpected Person create response: ${JSON.stringify(created)}`);
    }
    console.log(`[twenty:seed] Created Person ${personId}.`);
  }

  console.log("[twenty:seed] Ensuring demo job postings…");

  const jobSeeds = [
    {
      name: "Frontend Engineer",
      payload: {
        [RECRUITING_JOB_POSTING_FIELDS.companyName]: "Atlas Product Studio",
        [RECRUITING_JOB_POSTING_FIELDS.location]: "Ho Chi Minh City",
        [RECRUITING_JOB_POSTING_FIELDS.workMode]: "hybrid",
        [RECRUITING_JOB_POSTING_FIELDS.salaryMinVnd]: 35_000_000,
        [RECRUITING_JOB_POSTING_FIELDS.salaryMaxVnd]: 55_000_000,
        [RECRUITING_JOB_POSTING_FIELDS.seniority]: "mid",
        [RECRUITING_JOB_POSTING_FIELDS.requiredSkills]: "React, TypeScript, Next.js",
        [RECRUITING_JOB_POSTING_FIELDS.description]:
          "Build customer-facing SaaS workflows with a product engineering team.",
      },
    },
    {
      name: "Backend Engineer",
      payload: {
        [RECRUITING_JOB_POSTING_FIELDS.companyName]: "Northstar HR Cloud",
        [RECRUITING_JOB_POSTING_FIELDS.location]: "Ha Noi",
        [RECRUITING_JOB_POSTING_FIELDS.workMode]: "onsite",
        [RECRUITING_JOB_POSTING_FIELDS.salaryMinVnd]: 45_000_000,
        [RECRUITING_JOB_POSTING_FIELDS.salaryMaxVnd]: 70_000_000,
        [RECRUITING_JOB_POSTING_FIELDS.seniority]: "senior",
        [RECRUITING_JOB_POSTING_FIELDS.requiredSkills]: "Node.js, NestJS, PostgreSQL",
        [RECRUITING_JOB_POSTING_FIELDS.description]:
          "Own APIs, queue workers, and tenant data workflows.",
      },
    },
    {
      name: "AI Engineer",
      payload: {
        [RECRUITING_JOB_POSTING_FIELDS.companyName]: "Signal Recruit",
        [RECRUITING_JOB_POSTING_FIELDS.location]: "Ho Chi Minh City",
        [RECRUITING_JOB_POSTING_FIELDS.workMode]: "remote",
        [RECRUITING_JOB_POSTING_FIELDS.salaryMinVnd]: 55_000_000,
        [RECRUITING_JOB_POSTING_FIELDS.salaryMaxVnd]: 85_000_000,
        [RECRUITING_JOB_POSTING_FIELDS.seniority]: "mid-senior",
        [RECRUITING_JOB_POSTING_FIELDS.requiredSkills]: "Python, LLM, SQL",
        [RECRUITING_JOB_POSTING_FIELDS.description]:
          "Prototype AI recruiter workflows and evaluation pipelines.",
      },
    },
  ] as const;

  const jobIds: Record<string, string> = {};

  for (const job of jobSeeds) {
    const found = await findJobPostingByName(baseUrl, apiKey, job.name);
    if (found?.id) {
      jobIds[job.name] = String(found.id);
      console.log(`[twenty:seed] Job posting exists: ${job.name} (${jobIds[job.name]}).`);
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
          ...job.payload,
        },
      },
    });

    const row = extractSingularRecord(created);
    const id = row?.id ? String(row.id) : "";
    if (!id) {
      throw new Error(`[twenty:seed] Unexpected jobPosting create response: ${JSON.stringify(created)}`);
    }
    jobIds[job.name] = id;
    console.log(`[twenty:seed] Created job posting ${job.name} (${id}).`);
  }

  console.log("[twenty:seed] Ensuring demo applications…");

  const applications = [
    {
      jobName: "Frontend Engineer" as const,
      pipelineStage: "screening",
      matchScore: 82,
    },
    {
      jobName: "Backend Engineer" as const,
      pipelineStage: "interview",
      matchScore: 74,
    },
  ];

  for (const application of applications) {
    const jobPostingRecordId = jobIds[application.jobName];
    const exists = await findApplication(baseUrl, apiKey, {
      candidateExternalId: DEMO_EXTERNAL_USER_ID,
      jobPostingRecordId,
    });

    if (exists) {
      console.log(
        `[twenty:seed] Application already exists for ${application.jobName} (${String(exists.id ?? "")}).`,
      );
      continue;
    }

    await twentyHttpJson({
      baseUrl,
      apiKey,
      request: {
        path: `/rest/${RECRUITING_OBJECTS.jobApplication.namePlural}`,
        method: "POST",
        body: {
          [RECRUITING_JOB_APPLICATION_FIELDS.candidateExternalId]: DEMO_EXTERNAL_USER_ID,
          [RECRUITING_JOB_APPLICATION_FIELDS.jobPostingRecordId]: jobPostingRecordId,
          [RECRUITING_JOB_APPLICATION_FIELDS.pipelineStage]: application.pipelineStage,
          [RECRUITING_JOB_APPLICATION_FIELDS.matchScore]: application.matchScore,
        },
      },
    });

    console.log(`[twenty:seed] Created application for ${application.jobName}.`);
  }

  console.log("[twenty:seed] Done.", { personId, jobIds });
}

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

async function findJobPostingByName(baseUrl: string, apiKey: string, title: string) {
  const payload = await twentyHttpJson<unknown>({
    baseUrl,
    apiKey,
    request: {
      path: `/rest/${RECRUITING_OBJECTS.jobPosting.namePlural}`,
      method: "GET",
      query: {
        filter: `name[eq]:${title}`,
        limit: "5",
      },
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
    if (!value) continue;
    if (Array.isArray(value)) continue;
    if (typeof value === "object") {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

loadRepoEnvLocal();

seedRecruitingDemoData().catch((error) => {
  console.error("[twenty:seed] Failed:", error);
  process.exitCode = 1;
});
