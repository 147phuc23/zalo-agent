/**
 * Idempotent recruiting schema for Twenty (Person fields + custom job objects).
 *
 * Requires an API key with **Settings → Data model** permissions.
 *
 * Usage (from repo root):
 *   pnpm --filter @platform/worker twenty:schema
 */
import { loadTwentyEnv } from "../../src/agent/twenty/twenty-env.js";
import { TwentyHttpError, twentyHttpJson } from "../../src/agent/twenty/twenty-http.js";
import { extractMetadataRows } from "../../src/agent/twenty/twenty-rest-parsers.js";
import {
  RECRUITING_JOB_APPLICATION_FIELDS,
  RECRUITING_JOB_POSTING_FIELDS,
  RECRUITING_OBJECTS,
  RECRUITING_PERSON_FIELDS,
} from "../../src/agent/twenty/recruiting-schema-constants.js";
import { loadRepoEnvLocal } from "./load-repo-env.js";

type MetadataRow = Record<string, unknown>;

type SelectOption = {
  position: number;
  label: string;
  value: string;
  color: "gray" | "sky" | "blue" | "green" | "turquoise" | "purple" | "pink" | "red" | "orange" | "yellow";
};

export async function applyRecruitingSchema() {
  const env = loadTwentyEnv();
  const baseUrl = env.TWENTY_BASE_URL;
  const apiKey = env.TWENTY_API_KEY;

  console.log("[twenty:schema] Loading metadata…");

  const objects = readMetadataRows(
    await twentyHttpJson<unknown>({
      baseUrl,
      apiKey,
      request: { path: "/rest/metadata/objects", method: "GET", query: { limit: "2000" } },
    }),
  );

  const fields: MetadataRow[] = objects.flatMap((obj) => {
    const rawFields = (obj.fields as unknown[]) || [];
    return rawFields.map((f: any) => ({
      ...f,
      objectMetadataId: obj.id,
    }));
  });

  const personObject = findObjectBySingular(objects, "person");
  if (!personObject?.id) {
    throw new Error("[twenty:schema] Standard `person` object not found in metadata.");
  }

  const personObjectId = String(personObject.id);

  console.log("[twenty:schema] Ensuring Person recruiting fields…");

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.externalUserId,
    label: "External user id",
    description: "Zalo / connector external user id",
    isNullable: true,
    isUnique: true,
  });

  await ensureSelectField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.recruitingPipelineStage,
    label: "Recruiting pipeline stage",
    isNullable: true,
    options: [
      { position: 0, label: "New", value: "NEW", color: "gray" },
      { position: 1, label: "Screening", value: "SCREENING", color: "sky" },
      { position: 2, label: "Interviewing", value: "INTERVIEWING", color: "blue" },
      { position: 3, label: "Placed", value: "PLACED", color: "green" },
      { position: 4, label: "Paused", value: "PAUSED", color: "orange" },
    ],
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.skillsSummary,
    label: "Skills summary",
    description: "Comma-separated skills for recruiting workflows",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.preferredRolesSummary,
    label: "Preferred roles summary",
    description: "Comma-separated role titles",
    isNullable: true,
  });

  await ensureNumberField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.salaryExpectationVnd,
    label: "Salary expectation (VND)",
    isNullable: true,
  });

  await ensureNumberField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.yearsExperience,
    label: "Years of experience",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.currentTitle,
    label: "Current title",
    description: "Current or most recent job title",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.currentCompany,
    label: "Current company",
    isNullable: true,
  });

  await ensureNumberField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.noticePeriodDays,
    label: "Notice period (days)",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.linkedinUrl,
    label: "LinkedIn URL",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.education,
    label: "Education",
    description: "Educational background (University, degree, major)",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.resumeUrl,
    label: "Resume URL",
    description: "Link to candidate CV / resume file",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.candidateSource,
    label: "Candidate source",
    description: "Where candidate was sourced from (e.g. Zalo, LinkedIn)",
    isNullable: true,
  });

  await ensureNumberField(baseUrl, apiKey, fields, {
    objectMetadataId: personObjectId,
    name: RECRUITING_PERSON_FIELDS.hiringRating,
    label: "Hiring rating",
    description: "Overall candidate rating (1-5)",
    isNullable: true,
  });

  console.log("[twenty:schema] Ensuring custom objects…");

  let jobPostingObject =
    findObjectBySingular(objects, RECRUITING_OBJECTS.jobPosting.nameSingular) ??
    (await createCustomObject(baseUrl, apiKey, {
      nameSingular: RECRUITING_OBJECTS.jobPosting.nameSingular,
      namePlural: RECRUITING_OBJECTS.jobPosting.namePlural,
      labelSingular: "Job posting",
      labelPlural: "Job postings",
      description: "Open roles synced from recruiting workflows",
      icon: "IconBriefcase",
    }));

  const jobPostingObjectId = String(jobPostingObject.id);

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.companyName,
    label: "Company name",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.location,
    label: "Location",
    isNullable: true,
  });

  await ensureSelectField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.workMode,
    label: "Work mode",
    isNullable: true,
    options: [
      { position: 0, label: "Remote", value: "REMOTE", color: "sky" },
      { position: 1, label: "Hybrid", value: "HYBRID", color: "blue" },
      { position: 2, label: "Onsite", value: "ONSITE", color: "purple" },
    ],
  });

  await ensureNumberField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.salaryMinVnd,
    label: "Salary min (VND)",
    isNullable: true,
  });

  await ensureNumberField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.salaryMaxVnd,
    label: "Salary max (VND)",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.seniority,
    label: "Seniority",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.requiredSkills,
    label: "Required skills",
    description: "Comma-separated skill tokens used by search heuristics",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.description,
    label: "Role description",
    isNullable: true,
  });

  await ensureSelectField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.status,
    label: "Status",
    isNullable: true,
    options: [
      { position: 0, label: "Open", value: "OPEN", color: "green" },
      { position: 1, label: "Paused", value: "PAUSED", color: "orange" },
      { position: 2, label: "Closed", value: "CLOSED", color: "red" },
    ],
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.department,
    label: "Department",
    isNullable: true,
  });

  await ensureNumberField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.headcount,
    label: "Headcount",
    description: "Number of open seats",
    isNullable: true,
  });

  await ensureSelectField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.jobType,
    label: "Job type",
    isNullable: true,
    options: [
      { position: 0, label: "Full-time", value: "FULL_TIME", color: "green" },
      { position: 1, label: "Part-time", value: "PART_TIME", color: "blue" },
      { position: 2, label: "Contract", value: "CONTRACT", color: "orange" },
      { position: 3, label: "Internship", value: "INTERNSHIP", color: "turquoise" },
    ],
  });

  await ensureNumberField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.experienceRequiredYears,
    label: "Experience required (years)",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.benefits,
    label: "Benefits",
    description: "Company benefits and allowances",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: jobPostingObjectId,
    name: RECRUITING_JOB_POSTING_FIELDS.educationRequired,
    label: "Education required",
    description: "Required educational qualification",
    isNullable: true,
  });

  let jobApplicationObject =
    findObjectBySingular(objects, RECRUITING_OBJECTS.jobApplication.nameSingular) ??
    (await createCustomObject(baseUrl, apiKey, {
      nameSingular: RECRUITING_OBJECTS.jobApplication.nameSingular,
      namePlural: RECRUITING_OBJECTS.jobApplication.namePlural,
      labelSingular: "Job application",
      labelPlural: "Job applications",
      description: "Candidate applications with lightweight linkage fields",
      icon: "IconUserCircle",
    }));

  const jobApplicationObjectId = String(jobApplicationObject.id);

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: jobApplicationObjectId,
    name: RECRUITING_JOB_APPLICATION_FIELDS.candidateExternalId,
    label: "Candidate external id",
    description: "Matches Person.externalUserId / Zalo id",
    isNullable: true,
  });

  await ensureTextField(baseUrl, apiKey, fields, {
    objectMetadataId: jobApplicationObjectId,
    name: RECRUITING_JOB_APPLICATION_FIELDS.jobPostingRecordId,
    label: "Job posting record id",
    description: "Twenty record id for related jobPosting",
    isNullable: true,
  });

  await ensureSelectField(baseUrl, apiKey, fields, {
    objectMetadataId: jobApplicationObjectId,
    name: RECRUITING_JOB_APPLICATION_FIELDS.pipelineStage,
    label: "Pipeline stage",
    isNullable: true,
    options: [
      { position: 0, label: "Applied", value: "APPLIED", color: "gray" },
      { position: 1, label: "Screening", value: "SCREENING", color: "sky" },
      { position: 2, label: "Interview", value: "INTERVIEW", color: "blue" },
      { position: 3, label: "Offer", value: "OFFER", color: "green" },
      { position: 4, label: "Rejected", value: "REJECTED", color: "red" },
      { position: 5, label: "Withdrawn", value: "WITHDRAWN", color: "orange" },
    ],
  });

  await ensureNumberField(baseUrl, apiKey, fields, {
    objectMetadataId: jobApplicationObjectId,
    name: RECRUITING_JOB_APPLICATION_FIELDS.matchScore,
    label: "Match score",
    isNullable: true,
  });

  console.log("[twenty:schema] Done.");
}

function readMetadataRows(payload: unknown): MetadataRow[] {
  return extractMetadataRows(payload).filter(
    (row): row is MetadataRow => Boolean(row) && typeof row === "object",
  );
}

function findObjectBySingular(rows: MetadataRow[], nameSingular: string): MetadataRow | undefined {
  return rows.find((row) => row.nameSingular === nameSingular);
}

function fieldExists(rows: MetadataRow[], objectMetadataId: string, name: string): boolean {
  return rows.some(
    (row) =>
      String(row.objectMetadataId ?? "") === objectMetadataId && String(row.name ?? "") === name,
  );
}

async function createCustomObject(
  baseUrl: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<MetadataRow> {
  console.log(`[twenty:schema] Creating object ${String(body.nameSingular)}…`);
  try {
    const created = await twentyHttpJson<unknown>({
      baseUrl,
      apiKey,
      request: {
        path: "/rest/metadata/objects",
        method: "POST",
        body,
      },
    });

    const rows = readMetadataRows(created);
    const row = rows[0];
    if (!row?.id) {
      throw new Error(`[twenty:schema] Unexpected create object response: ${JSON.stringify(created)}`);
    }
    // Wait for Twenty metadata cache to update before adding fields
    console.log("[twenty:schema] Waiting 3s for metadata cache...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return row;
  } catch (error) {
    if (error instanceof TwentyHttpError) {
      console.warn(
        `[twenty:schema] Create object failed (${error.status}). If it already exists, re-fetch metadata and continue.`,
      );
    }
    throw error;
  }
}

async function ensureTextField(
  baseUrl: string,
  apiKey: string,
  rows: MetadataRow[],
  input: {
    objectMetadataId: string;
    name: string;
    label: string;
    description?: string;
    isNullable?: boolean;
    isUnique?: boolean;
  },
) {
  if (fieldExists(rows, input.objectMetadataId, input.name)) {
    console.log(`[twenty:schema] Field exists: ${input.objectMetadataId}.${input.name}`);
    return;
  }

  await createField(baseUrl, apiKey, {
    objectMetadataId: input.objectMetadataId,
    type: "TEXT",
    name: input.name,
    label: input.label,
    description: input.description,
    isNullable: input.isNullable ?? true,
    isUnique: input.isUnique ?? false,
  });

  rows.push({
    objectMetadataId: input.objectMetadataId,
    name: input.name,
    type: "TEXT",
  });
}

async function ensureNumberField(
  baseUrl: string,
  apiKey: string,
  rows: MetadataRow[],
  input: {
    objectMetadataId: string;
    name: string;
    label: string;
    description?: string;
    isNullable?: boolean;
  },
) {
  if (fieldExists(rows, input.objectMetadataId, input.name)) {
    console.log(`[twenty:schema] Field exists: ${input.objectMetadataId}.${input.name}`);
    return;
  }

  await createField(baseUrl, apiKey, {
    objectMetadataId: input.objectMetadataId,
    type: "NUMBER",
    name: input.name,
    label: input.label,
    description: input.description,
    isNullable: input.isNullable ?? true,
  });

  rows.push({
    objectMetadataId: input.objectMetadataId,
    name: input.name,
    type: "NUMBER",
  });
}

async function ensureSelectField(
  baseUrl: string,
  apiKey: string,
  rows: MetadataRow[],
  input: {
    objectMetadataId: string;
    name: string;
    label: string;
    description?: string;
    isNullable?: boolean;
    options: SelectOption[];
  },
) {
  if (fieldExists(rows, input.objectMetadataId, input.name)) {
    console.log(`[twenty:schema] Field exists: ${input.objectMetadataId}.${input.name}`);
    return;
  }

  await createField(baseUrl, apiKey, {
    objectMetadataId: input.objectMetadataId,
    type: "SELECT",
    name: input.name,
    label: input.label,
    description: input.description,
    isNullable: input.isNullable ?? true,
    options: input.options,
  });

  rows.push({
    objectMetadataId: input.objectMetadataId,
    name: input.name,
    type: "SELECT",
  });
}

async function createField(baseUrl: string, apiKey: string, body: Record<string, unknown>) {
  try {
    console.log(`[twenty:schema] Creating field ${String(body.name)} on object ${String(body.objectMetadataId)}…`);
    await twentyHttpJson({
      baseUrl,
      apiKey,
      request: {
        path: "/rest/metadata/fields",
        method: "POST",
        body,
      },
    });
  } catch (error) {
    if (error instanceof TwentyHttpError) {
      console.warn(`[twenty:schema] Field create HTTP ${error.status}: ${JSON.stringify(error.responseBody)}`);
    }
    throw error;
  }
}

loadRepoEnvLocal();

applyRecruitingSchema().catch((error) => {
  console.error("[twenty:schema] Failed:", error);
  process.exitCode = 1;
});
