/**
 * Field and object names used by recruiting schema-as-code and the Twenty recruiting adapter.
 * Must stay in sync with `scripts/twenty/apply-recruiting-schema.ts`.
 */
export const RECRUITING_PERSON_FIELDS = {
    externalUserId: "externalUserId",
    recruitingPipelineStage: "recruitingPipelineStage",
    skillsSummary: "skillsSummary",
    preferredRolesSummary: "preferredRolesSummary",
    salaryExpectationVnd: "salaryExpectationVnd",
    yearsExperience: "yearsExperience",
    currentTitle: "currentTitle",
    currentCompany: "currentCompany",
    noticePeriodDays: "noticePeriodDays",
    linkedinUrl: "linkedinUrl",
};
export const RECRUITING_OBJECTS = {
    jobPosting: {
        nameSingular: "jobPosting",
        namePlural: "jobPostings",
    },
    jobApplication: {
        nameSingular: "jobApplication",
        namePlural: "jobApplications",
    },
};
export const RECRUITING_JOB_POSTING_FIELDS = {
    companyName: "companyName",
    location: "location",
    workMode: "workMode",
    salaryMinVnd: "salaryMinVnd",
    salaryMaxVnd: "salaryMaxVnd",
    seniority: "seniority",
    requiredSkills: "requiredSkills",
    description: "description",
    status: "status",
    department: "department",
    headcount: "headcount",
};
export const RECRUITING_JOB_APPLICATION_FIELDS = {
    pipelineStage: "pipelineStage",
    matchScore: "matchScore",
    /** Zalo / connector external id — avoids RELATION metadata in schema-as-code. */
    candidateExternalId: "candidateExternalId",
    /** Twenty record id of `jobPosting` as TEXT (UUID string). */
    jobPostingRecordId: "jobPostingRecordId",
};
