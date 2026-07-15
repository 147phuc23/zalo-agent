import type { createRepositorySet } from "@platform/database";
import type { CandidateRequirement } from "@platform/agent";

type Repos = ReturnType<typeof createRepositorySet>;

export type KnownFacts = {
  text: string;
  requirement: CandidateRequirement;
};

export async function buildKnownFacts(
  repos: Repos,
  conversationId: string,
): Promise<KnownFacts | undefined> {
  const audits = await repos.audits.listByConversation(conversationId);
  if (!audits || audits.length === 0) {
    return undefined;
  }

  let latestGather: any = null;
  let latestSaveIntent: any = null;
  let latestProfile: any = null;
  const jobsSearched = new Set<string>();

  for (const audit of audits) {
    if (audit.status !== "ok") continue;

    const toolName = audit.tool_name;
    let outputObj: any = null;
    if (typeof audit.output === "string") {
      try {
        outputObj = JSON.parse(audit.output);
      } catch {
        continue;
      }
    } else {
      outputObj = audit.output;
    }

    if (!outputObj) continue;

    if (toolName === "hr_gatherRequirement" || toolName === "requirement_normalizer") {
      latestGather = outputObj;
    } else if (toolName === "memory_saveInteractionIntent") {
      latestSaveIntent = outputObj;
    } else if (toolName === "crm_getCandidateProfile" || toolName === "twenty_getCandidateProfile") {
      latestProfile = outputObj;
    } else if (toolName === "jobs_search" || toolName === "twenty_searchJobs") {
      if (Array.isArray(outputObj.jobs)) {
        for (const job of outputObj.jobs) {
          const id = job.id || job.external_id;
          const title = job.title;
          const company = job.company;
          if (id) {
            jobsSearched.add(`[${id}] ${title}${company ? ` @ ${company}` : ""}`);
          }
        }
      }
    }
  }

  const lines: string[] = [];
  let requirement: Record<string, any> = {};
  let intent: string | null = null;

  if (latestGather?.requirement) {
    requirement = { ...requirement, ...latestGather.requirement };
  }
  if (latestSaveIntent?.requirement) {
    requirement = { ...requirement, ...latestSaveIntent.requirement };
  }
  if (latestSaveIntent?.intent) {
    intent = latestSaveIntent.intent;
  }

  const profileFacts: string[] = [];
  if (latestProfile) {
    const keys = ["displayName", "phone", "email", "location", "yearsOfExperience", "skills", "preferredRoles"];
    for (const key of keys) {
      const val = latestProfile[key];
      if (val !== undefined && val !== null && val !== "" && (!Array.isArray(val) || val.length > 0)) {
        profileFacts.push(`${key}: ${typeof val === "object" ? JSON.stringify(val) : val}`);
      }
    }
  }

  const reqLines: string[] = [];
  for (const [k, v] of Object.entries(requirement)) {
    if (v !== undefined && v !== null && v !== "" && (!Array.isArray(v) || v.length > 0)) {
      reqLines.push(`${k}=${typeof v === "object" ? JSON.stringify(v) : v}`);
    }
  }

  if (intent) {
    lines.push(`- Intent: ${intent}`);
  }
  if (reqLines.length > 0) {
    lines.push(`- Requirement: ${reqLines.join(", ")}`);
  }
  if (profileFacts.length > 0) {
    lines.push(`- CRM Profile Facts: ${profileFacts.join(", ")}`);
  }
  if (jobsSearched.size > 0) {
    lines.push(`- Jobs already shown: ${Array.from(jobsSearched).join(", ")}`);
  }

  if (lines.length === 0) {
    return undefined;
  }

  return {
    text: [
      "# Known Facts So Far (from earlier tool results - do not re-ask these)",
      ...lines,
    ].join("\n"),
    requirement: requirement as CandidateRequirement,
  };
}
