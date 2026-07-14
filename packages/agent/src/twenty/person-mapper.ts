import { extractLocationSlugs, normalizeLocation } from "../core/location-normalizer.js";
import type { CandidateProfile, JobPosting } from "../types.js";
import {
  RECRUITING_JOB_APPLICATION_FIELDS,
  RECRUITING_JOB_POSTING_FIELDS,
  RECRUITING_PERSON_FIELDS,
} from "./recruiting-schema-constants.js";

export function mapTwentyPersonToCandidateProfile(input: {
  record: Record<string, unknown>;
  externalUserId: string;
}): CandidateProfile {
  const raw = input.record;

  const nameBlock = raw.name as Record<string, unknown> | undefined;
  const first = typeof nameBlock?.firstName === "string" ? nameBlock.firstName : "";
  const last = typeof nameBlock?.lastName === "string" ? nameBlock.lastName : "";
  const joinedName = [first, last].filter(Boolean).join(" ").trim();

  const displayName =
    (typeof raw.displayName === "string" && raw.displayName.trim() !== ""
      ? raw.displayName
      : undefined) ??
    (joinedName || "Unknown Zalo Candidate");

  const skills = splitCommaList(readString(raw, RECRUITING_PERSON_FIELDS.skillsSummary));
  const preferredRoles = splitCommaList(readString(raw, RECRUITING_PERSON_FIELDS.preferredRolesSummary));

  const rawLocation = readString(raw, "city") ?? readString(raw, "addressFull") ?? undefined;
  const location = rawLocation ? normalizeLocation(rawLocation) : undefined;

  return {
    externalUserId: input.externalUserId,
    displayName,
    phone: readPhone(raw),
    email: readEmail(raw),
    location,
    yearsOfExperience: readNumber(raw, RECRUITING_PERSON_FIELDS.yearsExperience),
    currentTitle: readString(raw, "jobTitle") ?? undefined,
    skills,
    preferredRoles,
    salaryExpectationVnd: readNumber(raw, RECRUITING_PERSON_FIELDS.salaryExpectationVnd),
    availability: readString(raw, "availability") ?? undefined,
    notes: buildNotes(raw),
    education: readString(raw, RECRUITING_PERSON_FIELDS.education) ?? undefined,
    resumeUrl: readString(raw, RECRUITING_PERSON_FIELDS.resumeUrl) ?? undefined,
    candidateSource: readString(raw, RECRUITING_PERSON_FIELDS.candidateSource) ?? undefined,
    hiringRating: readNumber(raw, RECRUITING_PERSON_FIELDS.hiringRating),
  };
}

export function mapTwentyJobPostingRecord(raw: Record<string, unknown>): JobPosting {
  const title =
    (typeof raw.name === "string" && raw.name ? raw.name : null) ??
    (typeof raw.title === "string" ? raw.title : "Untitled role");

  const workMode = normalizeWorkMode(readString(raw, RECRUITING_JOB_POSTING_FIELDS.workMode));
  const location = readString(raw, RECRUITING_JOB_POSTING_FIELDS.location) ?? "";

  return {
    id: typeof raw.id === "string" ? raw.id : "unknown",
    title,
    company: readString(raw, RECRUITING_JOB_POSTING_FIELDS.companyName) ?? "",
    locationSlugs: extractLocationSlugs(location),
    workMode,
    salaryMinVnd: readNumber(raw, RECRUITING_JOB_POSTING_FIELDS.salaryMinVnd) ?? 0,
    salaryMaxVnd: readNumber(raw, RECRUITING_JOB_POSTING_FIELDS.salaryMaxVnd) ?? 0,
    seniority: readString(raw, RECRUITING_JOB_POSTING_FIELDS.seniority) ?? "",
    requiredSkills: splitCommaList(readString(raw, RECRUITING_JOB_POSTING_FIELDS.requiredSkills)),
    description: readString(raw, RECRUITING_JOB_POSTING_FIELDS.description) ?? "",
    jobType: (readString(raw, RECRUITING_JOB_POSTING_FIELDS.jobType) as unknown as "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP") ?? undefined,
    experienceRequiredYears: readNumber(raw, RECRUITING_JOB_POSTING_FIELDS.experienceRequiredYears),
    benefits: readString(raw, RECRUITING_JOB_POSTING_FIELDS.benefits) ?? undefined,
    educationRequired: readString(raw, RECRUITING_JOB_POSTING_FIELDS.educationRequired) ?? undefined,
  };
}

export function mapTwentyJobApplicationRecord(input: {
  application: Record<string, unknown>;
  jobPostingById: Map<string, Record<string, unknown>>;
}): {
  id: string;
  pipelineStage: string;
  matchScore: number | null;
  job: ReturnType<typeof mapTwentyJobPostingRecord> | null;
} {
  const app = input.application;
  const id = typeof app.id === "string" ? app.id : "unknown";
  const pipelineStage = readString(app, RECRUITING_JOB_APPLICATION_FIELDS.pipelineStage) ?? "unknown";
  const matchScore = readNullableNumber(app, RECRUITING_JOB_APPLICATION_FIELDS.matchScore);

  const jobId = readString(app, RECRUITING_JOB_APPLICATION_FIELDS.jobPostingRecordId);
  const rawJob = jobId ? input.jobPostingById.get(jobId) : undefined;
  const job = rawJob ? mapTwentyJobPostingRecord(rawJob) : null;

  return { id, pipelineStage, matchScore, job };
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return null;
  return String(value);
}

function readNullableNumber(record: Record<string, unknown>, key: string): number | null {
  const n = readNumber(record, key);
  return n === undefined ? null : n;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function readPhone(record: Record<string, unknown>): string | undefined {
  const phones = record.phones;
  if (phones && typeof phones === "object") {
    const primaryPhone = (phones as { primaryPhoneNumber?: string }).primaryPhoneNumber;
    if (typeof primaryPhone === "string") return primaryPhone;
  }
  return undefined;
}

function readEmail(record: Record<string, unknown>): string | undefined {
  const emails = record.emails;
  if (emails && typeof emails === "object") {
    const primary = (emails as { primaryEmail?: string }).primaryEmail;
    if (typeof primary === "string") return primary;
  }
  return undefined;
}

function splitCommaList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeWorkMode(value: string | null): "remote" | "hybrid" | "onsite" {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "remote" || normalized === "hybrid" || normalized === "onsite") {
    return normalized;
  }
  return "hybrid";
}

function buildNotes(record: Record<string, unknown>): string[] | undefined {
  const stage = readString(record, RECRUITING_PERSON_FIELDS.recruitingPipelineStage);
  const notes: string[] = [];
  if (stage) {
    notes.push(`Recruiting pipeline stage: ${stage}`);
  }
  if (notes.length === 0) return undefined;
  return notes;
}
