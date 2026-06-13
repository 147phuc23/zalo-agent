import { loadTwentyEnv, normalizeTwentyBaseUrl } from "./twenty-env.js";
import { twentyHttpJson } from "./twenty-http.js";
import { extractCoreManyRecords, extractMetadataRows, pickFirstRecord, } from "./twenty-rest-parsers.js";
import { mapTwentyJobApplicationRecord, mapTwentyJobPostingRecord, mapTwentyPersonToCandidateProfile, } from "./person-mapper.js";
import { RECRUITING_JOB_APPLICATION_FIELDS, RECRUITING_OBJECTS, RECRUITING_PERSON_FIELDS, } from "./recruiting-schema-constants.js";
/** Pipeline stages considered active / “in progress” for UX summaries. */
export const IN_PROGRESS_APPLICATION_STAGES = ["applied", "screening", "interview"];
export function createTwentyRecruitingClientFromEnv() {
    const env = loadTwentyEnv();
    return new TwentyRecruitingClient({
        baseUrl: env.TWENTY_BASE_URL,
        apiKey: env.TWENTY_API_KEY,
    });
}
export class TwentyRecruitingClient {
    options;
    constructor(options) {
        this.options = options;
    }
    get baseUrl() {
        return normalizeTwentyBaseUrl(this.options.baseUrl);
    }
    async loadCandidateProfile(input) {
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
    async findPersonByExternalUserId(externalUserId) {
        const filter = buildEqFilter(RECRUITING_PERSON_FIELDS.externalUserId, externalUserId);
        const payload = await twentyHttpJson({
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
    async searchJobPostings(input) {
        const payload = await twentyHttpJson({
            baseUrl: this.options.baseUrl,
            apiKey: this.options.apiKey,
            request: {
                path: `/rest/${RECRUITING_OBJECTS.jobPosting.namePlural}`,
                method: "GET",
                query: { limit: "60" },
            },
        });
        const rows = extractCoreManyRecords(payload)
            .filter((row) => Boolean(row) && typeof row === "object")
            .map((row) => mapTwentyJobPostingRecord(row));
        if (!hasActiveJobFilters(input)) {
            return [...rows].sort((a, b) => a.title.localeCompare(b.title));
        }
        return scoreAndSortJobs(rows, input);
    }
    async getCandidateRecruitingStatus(input) {
        const person = await this.findPersonByExternalUserId(input.externalUserId);
        if (!person) {
            return { pipelineStage: null, personFound: false };
        }
        const stage = readOptionalString(person, RECRUITING_PERSON_FIELDS.recruitingPipelineStage);
        return { pipelineStage: stage, personFound: true };
    }
    async listInProgressApplications(input) {
        const applicationsPayload = await twentyHttpJson({
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
        const applicationRows = extractCoreManyRecords(applicationsPayload).filter((row) => Boolean(row) && typeof row === "object");
        const jobPostingIds = Array.from(new Set(applicationRows
            .map((row) => readOptionalString(row, RECRUITING_JOB_APPLICATION_FIELDS.jobPostingRecordId))
            .filter(Boolean)));
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
    async computeJobMatchScores(input) {
        const jobs = input.jobs ?? (await this.searchJobPostings({}));
        const results = jobs.map((job) => scoreJobAgainstProfile(job, input.profile));
        return results.sort((a, b) => b.score - a.score);
    }
    async listMetadataObjects() {
        const payload = await twentyHttpJson({
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
    async listMetadataFields() {
        const payload = await twentyHttpJson({
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
    async loadJobPostingsByIds(ids) {
        const map = new Map();
        for (const id of ids) {
            const payload = await twentyHttpJson({
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
function readOptionalString(record, key) {
    const value = record[key];
    if (typeof value === "string")
        return value;
    if (value === null || value === undefined)
        return null;
    return String(value);
}
function buildEqFilter(field, rawValue) {
    return `${field}[eq]:${rawValue}`;
}
function hasActiveJobFilters(filters) {
    if (filters.role?.trim())
        return true;
    if (filters.location?.trim())
        return true;
    if (filters.workMode)
        return true;
    if (typeof filters.salaryMinVnd === "number")
        return true;
    if (filters.skills && filters.skills.length > 0)
        return true;
    return false;
}
function scoreAndSortJobs(jobs, filters) {
    const skills = new Set((filters.skills ?? []).map((s) => s.toLowerCase()));
    const scored = jobs.map((job) => {
        let score = 0;
        const reasons = [];
        if (filters.role && job.title.toLowerCase().includes(filters.role.toLowerCase())) {
            score += 4;
            reasons.push("title matches role");
        }
        if (filters.location && job.location.toLowerCase().includes(filters.location.toLowerCase())) {
            score += 2;
            reasons.push("location matches");
        }
        if (filters.workMode && job.workMode === filters.workMode) {
            score += 2;
            reasons.push("work mode matches");
        }
        if (filters.salaryMinVnd && job.salaryMaxVnd >= filters.salaryMinVnd) {
            score += 2;
            reasons.push("compensation range fits minimum");
        }
        for (const skill of job.requiredSkills) {
            if (skills.has(skill.toLowerCase())) {
                score += 1;
                reasons.push(`skill ${skill}`);
            }
        }
        return { job, score, reasons };
    });
    const filtered = scored.filter((entry) => entry.score > 0);
    return filtered
        .sort((a, b) => b.score - a.score || a.job.title.localeCompare(b.job.title))
        .map((entry) => entry.job);
}
function scoreJobAgainstProfile(job, profile) {
    let score = 0;
    const reasons = [];
    const pref = profile.preferredRoles.map((r) => r.toLowerCase());
    for (const role of pref) {
        if (role && job.title.toLowerCase().includes(role)) {
            score += 4;
            reasons.push(`preferred role "${role}" aligns with title`);
        }
    }
    for (const skill of profile.skills) {
        if (job.requiredSkills.some((req) => req.toLowerCase() === skill.toLowerCase())) {
            score += 2;
            reasons.push(`skill match ${skill}`);
        }
    }
    if (profile.salaryExpectationVnd && job.salaryMaxVnd >= profile.salaryExpectationVnd) {
        score += 1;
        reasons.push("salary band covers expectation");
    }
    if (score === 0) {
        reasons.push("weak match — gather more requirements or broaden search");
    }
    return { job, score, reasons };
}
