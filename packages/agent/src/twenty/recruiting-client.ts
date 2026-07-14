import type { CandidateProfile, JobPosting } from "../types.js";
import { scoreJob, scoreRoleMatch, scoreSalaryMatch } from "../core/location-normalizer.js";
import { loadTwentyEnv, normalizeTwentyBaseUrl } from "./twenty-env.js";
import { twentyHttpJson } from "./twenty-http.js";
import {
  extractCoreManyRecords,
  extractMetadataRows,
  pickFirstRecord,
} from "./twenty-rest-parsers.js";
import {
  mapTwentyJobApplicationRecord,
  mapTwentyJobPostingRecord,
  mapTwentyPersonToCandidateProfile,
} from "./person-mapper.js";
import {
  RECRUITING_JOB_APPLICATION_FIELDS,
  RECRUITING_OBJECTS,
  RECRUITING_PERSON_FIELDS,
} from "./recruiting-schema-constants.js";

export type TwentyRecruitingClientOptions = {
  baseUrl: string;
  apiKey: string;
};

/** Pipeline stages considered active / “in progress” for UX summaries. */
export const IN_PROGRESS_APPLICATION_STAGES = ["applied", "screening", "interview"] as const;

export function createTwentyRecruitingClientFromEnv(): TwentyRecruitingClient {
  const env = loadTwentyEnv();
  return new TwentyRecruitingClient({
    baseUrl: env.TWENTY_BASE_URL,
    apiKey: env.TWENTY_API_KEY,
  });
}

export class TwentyRecruitingClient {
  constructor(private readonly options: TwentyRecruitingClientOptions) {}

  get baseUrl(): string {
    return normalizeTwentyBaseUrl(this.options.baseUrl);
  }

  async loadCandidateProfile(input: { externalUserId: string }): Promise<CandidateProfile> {
    const record = await this.findPersonByExternalUserId(input.externalUserId);
    if (!record) {
      return {
        externalUserId: input.externalUserId,
        displayName: "Unknown Zalo Candidate",
        skills: [],
        preferredRoles: [],
        notes: ["No matching Twenty Person record; link `externalUserId` or run recruiting seed."],
      };
    }

    return mapTwentyPersonToCandidateProfile({
      record,
      externalUserId: input.externalUserId,
    });
  }

  async updateCandidateProfile(input: {
    externalUserId: string;
    patch: {
      displayName?: string;
      phone?: string;
      email?: string;
      location?: string;
      yearsOfExperience?: number;
      currentTitle?: string;
      skills?: string[];
      preferredRoles?: string[];
      salaryExpectationVnd?: number;
      availability?: string;
    };
  }): Promise<void> {
    const person = await this.findPersonByExternalUserId(input.externalUserId);
    
    const body: Record<string, unknown> = {};
    if (input.patch.displayName) {
      const parts = input.patch.displayName.split(" ");
      body.name = {
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
      };
    }
    if (input.patch.phone) {
      body.phones = { primaryPhoneNumber: input.patch.phone, primaryPhoneCountryCode: "" };
    }
    if (input.patch.email) {
      body.emails = { primaryEmail: input.patch.email };
    }
    if (input.patch.location) {
      body.city = input.patch.location;
    }
    if (input.patch.yearsOfExperience !== undefined) {
      body[RECRUITING_PERSON_FIELDS.yearsExperience] = input.patch.yearsOfExperience;
    }
    if (input.patch.currentTitle) {
      body.jobTitle = input.patch.currentTitle;
    }
    if (input.patch.skills) {
      body[RECRUITING_PERSON_FIELDS.skillsSummary] = input.patch.skills.join(", ");
    }
    if (input.patch.preferredRoles) {
      body[RECRUITING_PERSON_FIELDS.preferredRolesSummary] = input.patch.preferredRoles.join(", ");
    }
    if (input.patch.salaryExpectationVnd !== undefined) {
      body[RECRUITING_PERSON_FIELDS.salaryExpectationVnd] = input.patch.salaryExpectationVnd;
    }
    if (input.patch.availability) {
      body.availability = input.patch.availability;
    }

    if (person && typeof person.id === "string") {
      await twentyHttpJson({
        baseUrl: this.options.baseUrl,
        apiKey: this.options.apiKey,
        request: {
          path: `/rest/people/${person.id}`,
          method: "PATCH",
          body,
        },
      });
    } else {
      body[RECRUITING_PERSON_FIELDS.externalUserId] = input.externalUserId;
      await twentyHttpJson({
        baseUrl: this.options.baseUrl,
        apiKey: this.options.apiKey,
        request: {
          path: `/rest/people`,
          method: "POST",
          body,
        },
      });
    }
  }

  async findPersonByExternalUserId(externalUserId: string): Promise<Record<string, unknown> | null> {
    const filter = buildEqFilter(RECRUITING_PERSON_FIELDS.externalUserId, externalUserId);
    const payload = await twentyHttpJson<unknown>({
      baseUrl: this.options.baseUrl,
      apiKey: this.options.apiKey,
      request: {
        path: "/rest/people",
        method: "GET",
        query: { filter, limit: "5" },
      },
    });

    return pickFirstRecord(payload);
  }

  async searchJobPostings(input: {
    role?: string;
    location?: string;
    workMode?: "remote" | "hybrid" | "onsite";
    salaryMinVnd?: number;
    skills?: string[];
  }): Promise<JobPosting[]> {
    const payload = await twentyHttpJson<unknown>({
      baseUrl: this.options.baseUrl,
      apiKey: this.options.apiKey,
      request: {
        path: `/rest/${RECRUITING_OBJECTS.jobPosting.namePlural}`,
        method: "GET",
        query: { limit: "60" },
      },
    });

    const rows = extractCoreManyRecords(payload)
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map((row) => mapTwentyJobPostingRecord(row));

    if (!hasActiveJobFilters(input)) {
      return [...rows].sort((a, b) => a.title.localeCompare(b.title));
    }

    return scoreAndSortJobs(rows, input);
  }

  async getCandidateRecruitingStatus(input: { externalUserId: string }): Promise<{
    pipelineStage: string | null;
    personFound: boolean;
  }> {
    const person = await this.findPersonByExternalUserId(input.externalUserId);
    if (!person) {
      return { pipelineStage: null, personFound: false };
    }

    const stage = readOptionalString(person, RECRUITING_PERSON_FIELDS.recruitingPipelineStage);
    return { pipelineStage: stage, personFound: true };
  }

  async listInProgressApplications(input: { externalUserId: string }): Promise<
    Array<{
      id: string;
      pipelineStage: string;
      matchScore: number | null;
      job: JobPosting | null;
    }>
  > {
    const applicationsPayload = await twentyHttpJson<unknown>({
      baseUrl: this.options.baseUrl,
      apiKey: this.options.apiKey,
      request: {
        path: `/rest/${RECRUITING_OBJECTS.jobApplication.namePlural}`,
        method: "GET",
        query: {
          filter: buildEqFilter(RECRUITING_JOB_APPLICATION_FIELDS.candidateExternalId, input.externalUserId),
          limit: "60",
        },
      },
    });

    const applicationRows = extractCoreManyRecords(applicationsPayload).filter(
      (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
    );

    const jobPostingIds = Array.from(
      new Set(
        applicationRows
          .map((row) => readOptionalString(row, RECRUITING_JOB_APPLICATION_FIELDS.jobPostingRecordId))
          .filter(Boolean),
      ),
    ) as string[];

    const jobPostingById = await this.loadJobPostingsByIds(jobPostingIds);

    return applicationRows
      .filter((row) => {
        const stage = readOptionalString(row, RECRUITING_JOB_APPLICATION_FIELDS.pipelineStage);
        const normalized = stage?.toLowerCase() ?? "";
        return IN_PROGRESS_APPLICATION_STAGES.some((candidate) => candidate === normalized);
      })
      .map((row) => {
        const mapped = mapTwentyJobApplicationRecord({
          application: row,
          jobPostingById,
        });
        return {
          id: mapped.id,
          pipelineStage: mapped.pipelineStage,
          matchScore: mapped.matchScore,
          job: mapped.job,
        };
      });
  }

  async computeJobMatchScores(input: {
    profile: CandidateProfile;
    jobs?: JobPosting[];
  }): Promise<Array<{ job: JobPosting; score: number; reasons: string[] }>> {
    const jobs = input.jobs ?? (await this.searchJobPostings({}));
    const results = jobs.map((job) => scoreJobAgainstProfile(job, input.profile));
    return results.sort((a, b) => b.score - a.score);
  }

  async listMetadataObjects(): Promise<unknown[]> {
    const payload = await twentyHttpJson<unknown>({
      baseUrl: this.options.baseUrl,
      apiKey: this.options.apiKey,
      request: {
        path: "/rest/metadata/objects",
        method: "GET",
        query: { limit: "1000" },
      },
    });
    return extractMetadataRows(payload);
  }

  async listMetadataFields(): Promise<unknown[]> {
    const payload = await twentyHttpJson<unknown>({
      baseUrl: this.options.baseUrl,
      apiKey: this.options.apiKey,
      request: {
        path: "/rest/metadata/fields",
        method: "GET",
        query: { limit: "2000" },
      },
    });
    return extractMetadataRows(payload);
  }

  private async loadJobPostingsByIds(ids: string[]): Promise<Map<string, Record<string, unknown>>> {
    const map = new Map<string, Record<string, unknown>>();
    for (const id of ids) {
      const payload = await twentyHttpJson<unknown>({
        baseUrl: this.options.baseUrl,
        apiKey: this.options.apiKey,
        request: {
          path: `/rest/${RECRUITING_OBJECTS.jobPosting.namePlural}`,
          method: "GET",
          query: {
            filter: `id[eq]:${id}`,
            limit: "1",
          },
        },
      });
      const row = pickFirstRecord(payload);
      if (row) {
        map.set(id, row);
      }
    }
    return map;
  }
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return null;
  return String(value);
}

function buildEqFilter(field: string, rawValue: string): string {
  return `${field}[eq]:${rawValue}`;
}

function hasActiveJobFilters(filters: {
  role?: string;
  location?: string;
  workMode?: "remote" | "hybrid" | "onsite";
  salaryMinVnd?: number;
  skills?: string[];
}): boolean {
  if (filters.role?.trim()) return true;
  if (filters.location?.trim()) return true;
  if (filters.workMode) return true;
  if (typeof filters.salaryMinVnd === "number") return true;
  if (filters.skills && filters.skills.length > 0) return true;
  return false;
}

function scoreAndSortJobs(jobs: JobPosting[], filters: {
  role?: string;
  location?: string;
  workMode?: "remote" | "hybrid" | "onsite";
  salaryMinVnd?: number;
  skills?: string[];
}): JobPosting[] {
  const scored = jobs.map((job) => {
    const { score, reasons } = scoreJob(job, {
      ...filters,
      locations: filters.location ? [filters.location] : undefined,
    });
    return { job, score, reasons };
  });

  const filtered = scored.filter((entry) => entry.score > 0);
  return filtered
    .sort((a, b) => b.score - a.score || a.job.title.localeCompare(b.job.title))
    .map((entry) => entry.job);
}

function scoreJobAgainstProfile(job: JobPosting, profile: CandidateProfile): {
  job: JobPosting;
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];
  for (const role of profile.preferredRoles) {
    const roleMatch = scoreRoleMatch(role, job.title);
    if (roleMatch) {
      score += roleMatch.score;
      reasons.push(`preferred ${roleMatch.reason}`);
    }
  }

  for (const skill of profile.skills) {
    if (job.requiredSkills.some((req) => req.toLowerCase() === skill.toLowerCase())) {
      score += 2;
      reasons.push(`skill match ${skill}`);
    }
  }

  const salaryMatch = scoreSalaryMatch(profile.salaryExpectationVnd, job.salaryMaxVnd);
  if (salaryMatch) {
    score += salaryMatch.score;
    reasons.push(salaryMatch.reason);
  }

  if (score === 0) {
    reasons.push("weak match — gather more requirements or broaden search");
  }

  return { job, score, reasons };
}
