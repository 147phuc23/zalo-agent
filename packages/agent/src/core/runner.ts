import { generateText } from "ai";
import type { LanguageModel, ProviderMetadata } from "ai";
import { createOpenRouterChatModel } from "@platform/ai-client";
import { CustomerProfileCache } from "../cache/customer-profile-cache.js";
import {
  buildProviderCacheSettings,
  readProviderCacheDiagnostics,
} from "../cache/provider-cache.js";
import { loadDefaultSkills, loadTwentySkills } from "../cache/skill-cache.js";
import { getHistory, getIntent } from "../mock/store.js";
import { buildPromptCacheContext } from "../prompt/prompt-cache-context.js";
import {
  getMockCandidateProfile,
  getMockCandidateProfileRevision,
} from "../skills/crm-get-candidate-profile/mock-data.js";
import { createAgentTools } from "../skills/registry.js";
import { createTwentyAgentTools } from "../skills/twenty/registry.js";
import { createTwentyRecruitingClientFromEnv } from "../twenty/recruiting-client.js";
import {
  createDatabaseClient,
  createJobPostingRepository,
  createCompanyRepository,
  createContactRepository,
  createCandidateProfileRepository,
  createApplicationRepository,
  createGuestAccessRepository,
  createKnowledgeGapRepository,
  type JobPostingRow,
} from "@platform/database";
import type {
  HrAgentRunOptions,
  HrAgentRunResult,
  HrAgentState,
  JobPosting,
  SkillCacheResult,
} from "../types.js";

// Lazily-created, reused jobs repo backed by PLATFORM_DB_URL (Neon). Null when unset,
// in which case load-jobs falls back to the in-code mock list.
let jobsRepoSingleton: ReturnType<typeof createJobPostingRepository> | null = null;
function getJobsRepo() {
  if (jobsRepoSingleton) return jobsRepoSingleton;
  const url = process.env.PLATFORM_DB_URL;
  if (!url) return null;
  jobsRepoSingleton = createJobPostingRepository(
    createDatabaseClient({ PLATFORM_DB_URL: url }),
  );
  return jobsRepoSingleton;
}

let companyRepoSingleton: ReturnType<typeof createCompanyRepository> | null = null;
function getCompanyRepo() {
  if (companyRepoSingleton) return companyRepoSingleton;
  const url = process.env.PLATFORM_DB_URL;
  if (!url) return null;
  companyRepoSingleton = createCompanyRepository(
    createDatabaseClient({ PLATFORM_DB_URL: url }),
  );
  return companyRepoSingleton;
}

let contactsRepoSingleton: ReturnType<typeof createContactRepository> | null = null;
function getContactsRepo() {
  if (contactsRepoSingleton) return contactsRepoSingleton;
  const url = process.env.PLATFORM_DB_URL;
  if (!url) return null;
  contactsRepoSingleton = createContactRepository(
    createDatabaseClient({ PLATFORM_DB_URL: url }),
  );
  return contactsRepoSingleton;
}

let candidateProfileRepoSingleton: ReturnType<typeof createCandidateProfileRepository> | null = null;
function getCandidateProfileRepo() {
  if (candidateProfileRepoSingleton) return candidateProfileRepoSingleton;
  const url = process.env.PLATFORM_DB_URL;
  if (!url) return null;
  candidateProfileRepoSingleton = createCandidateProfileRepository(
    createDatabaseClient({ PLATFORM_DB_URL: url }),
  );
  return candidateProfileRepoSingleton;
}

let applicationsRepoSingleton: ReturnType<typeof createApplicationRepository> | null = null;
function getApplicationsRepo() {
  if (applicationsRepoSingleton) return applicationsRepoSingleton;
  const url = process.env.PLATFORM_DB_URL;
  if (!url) return null;
  applicationsRepoSingleton = createApplicationRepository(
    createDatabaseClient({ PLATFORM_DB_URL: url }),
  );
  return applicationsRepoSingleton;
}

let guestAccessRepoSingleton: ReturnType<typeof createGuestAccessRepository> | null = null;
function getGuestAccessRepo() {
  if (guestAccessRepoSingleton) return guestAccessRepoSingleton;
  const url = process.env.PLATFORM_DB_URL;
  if (!url) return null;
  guestAccessRepoSingleton = createGuestAccessRepository(
    createDatabaseClient({ PLATFORM_DB_URL: url }),
  );
  return guestAccessRepoSingleton;
}

let knowledgeGapsRepoSingleton: ReturnType<typeof createKnowledgeGapRepository> | null = null;
function getKnowledgeGapsRepo() {
  if (knowledgeGapsRepoSingleton) return knowledgeGapsRepoSingleton;
  const url = process.env.PLATFORM_DB_URL;
  if (!url) return null;
  knowledgeGapsRepoSingleton = createKnowledgeGapRepository(
    createDatabaseClient({ PLATFORM_DB_URL: url }),
  );
  return knowledgeGapsRepoSingleton;
}

function jobRowToPosting(row: JobPostingRow): JobPosting {
  return {
    id: row.external_id ?? row.id,
    title: row.title,
    company: row.company,
    companyIntro: row.company_introduction ?? undefined,
    companyBenefits: row.company_benefits ?? undefined,
    companyWorkStyle: row.company_work_style ?? undefined,
    locationSlugs: row.location_slugs ?? [],
    workMode: row.work_mode,
    salaryMinVnd: Number(row.salary_min_vnd),
    salaryMaxVnd: Number(row.salary_max_vnd),
    seniority: row.seniority,
    requiredSkills: row.required_skills ?? [],
    description: row.description,
    jobType: (row.job_type as JobPosting["jobType"]) ?? undefined,
    experienceRequiredYears: row.experience_required_years ?? undefined,
    benefits: row.benefits ?? undefined,
    educationRequired: row.education_required ?? undefined,
  };
}

const customerProfileCache = new CustomerProfileCache();

export async function runHrAgentScenario(
  options: HrAgentRunOptions,
): Promise<HrAgentRunResult> {
  const skillCache =
    options.skillMode === "twenty"
      ? await loadTwentySkills({ useCache: options.useLocalCache })
      : await loadDefaultSkills({ useCache: options.useLocalCache });

  const profileCache = await customerProfileCache.get({
    tenantId: options.scenario.tenantId,
    channel: options.scenario.channel,
    externalUserId: options.scenario.externalUserId,
    forceReload:
      options.forceProfileReload || Boolean(options.scenario.forceProfileReload),
    useCache: options.useLocalCache,
    cacheVersion:
      options.skillMode === "twenty"
        ? "twenty-recruiting-v1"
        : getMockCandidateProfileRevision(),
    loader: async (input) => {
      if (options.skillMode === "twenty") {
        const client = createTwentyRecruitingClientFromEnv();
        return client.loadCandidateProfile({ externalUserId: input.externalUserId });
      }

      const contactsRepo = getContactsRepo();
      const candidateProfileRepo = getCandidateProfileRepo();
      if (contactsRepo && candidateProfileRepo) {
        try {
          const contact = await contactsRepo.findByExternalUser({
            tenantId: input.tenantId,
            channel: input.channel,
            externalUserId: input.externalUserId,
          });
          if (contact) {
            const profile = await candidateProfileRepo.findByContact({
              tenantId: input.tenantId,
              contactId: contact.id,
            });
            if (profile) {
              return {
                externalUserId: input.externalUserId,
                displayName: profile.full_name || "",
                email: profile.email || "",
                phone: profile.phone || "",
                location: profile.location || "",
                yearsOfExperience: Number(profile.years_of_experience || 0),
                currentTitle: profile.current_title || "",
                skills: profile.skills || [],
                preferredRoles: profile.preferred_roles || [],
                salaryExpectationVnd: Number(profile.salary_expectation_vnd || 0),
                availability: profile.availability || "",
                notes: (profile.raw_extraction as any)?.notes || [],
              };
            }
          }
        } catch (err) {
          console.error("[runner] Failed to load candidate profile from database, falling back to mock:", err);
        }
      }

      return getMockCandidateProfile(input);
    },
  });

  const state = buildInitialState(options);
  const promptContext = buildPromptCacheContext({
    skillCache,
    loadedSkills: [],
    customerProfile: profileCache.profile,
    state,
    knownFacts: options.knownFacts,
    systemPromptOverride: options.systemPromptOverride,
  });

  if (options.mockLlm) {
    return buildMockResult({
      options,
      state,
      skillCache,
      profileCacheStatus: profileCache.status,
      promptHash: skillCache.hash,
      promptDiagnostics: promptContext.diagnostics,
    });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required unless --mock-llm is passed");
  }

  const providerCache = buildProviderCacheSettings({
    model: options.model,
    enabled: true,
  });

  const jobsRepo = getJobsRepo();
  const companyRepo = getCompanyRepo();
  const contactsRepo = getContactsRepo();
  const candidateProfileRepo = getCandidateProfileRepo();
  
  const candidateProfileCtx = contactsRepo && candidateProfileRepo ? {
    getProfile: async (input: { tenantId: string; channel: string; externalUserId: string }) => {
      const contact = await contactsRepo.findByExternalUser({
        tenantId: input.tenantId,
        channel: input.channel,
        externalUserId: input.externalUserId,
      });
      if (!contact) return null;
      const profile = await candidateProfileRepo.findByContact({
        tenantId: input.tenantId,
        contactId: contact.id,
      });
      if (!profile) return null;
      return {
        externalUserId: input.externalUserId,
        displayName: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        location: profile.location || "",
        yearsOfExperience: Number(profile.years_of_experience || 0),
        currentTitle: profile.current_title || "",
        skills: profile.skills || [],
        preferredRoles: profile.preferred_roles || [],
        salaryExpectationVnd: Number(profile.salary_expectation_vnd || 0),
        availability: profile.availability || "",
        notes: (profile.raw_extraction as any)?.notes || [],
      };
    },
    updateProfile: async (input: { tenantId: string; channel: string; externalUserId: string; patch: any }) => {
      let contact = await contactsRepo.findByExternalUser({
        tenantId: input.tenantId,
        channel: input.channel,
        externalUserId: input.externalUserId,
      });
      if (!contact) {
        contact = await contactsRepo.createShadow({
          tenantId: input.tenantId,
          channel: input.channel,
          externalUserId: input.externalUserId,
        });
      }
      const patch = input.patch;
      const existingProfile = await candidateProfileRepo.findByContact({
        tenantId: input.tenantId,
        contactId: contact.id,
      });

      const changes: Record<string, { old: any; new: any }> = {};
      if (existingProfile) {
        const checkField = (field: string, oldVal: any, newVal: any) => {
          if (newVal !== undefined && newVal !== oldVal) {
            changes[field] = { old: oldVal, new: newVal };
          }
        };
        checkField("fullName", existingProfile.full_name, patch.displayName);
        checkField("email", existingProfile.email, patch.email);
        checkField("phone", existingProfile.phone, patch.phone);
        checkField("location", existingProfile.location, patch.location);
        checkField("yearsOfExperience", existingProfile.years_of_experience ? Number(existingProfile.years_of_experience) : 0, patch.yearsOfExperience);
        checkField("currentTitle", existingProfile.current_title, patch.currentTitle);
        checkField("salaryExpectationVnd", existingProfile.salary_expectation_vnd ? Number(existingProfile.salary_expectation_vnd) : 0, patch.salaryExpectationVnd);
        checkField("availability", existingProfile.availability, patch.availability);
      }

      const profile = await candidateProfileRepo.upsert({
        tenantId: input.tenantId,
        contactId: contact.id,
        patch: {
          fullName: patch.displayName,
          email: patch.email,
          phone: patch.phone,
          location: patch.location,
          yearsOfExperience: patch.yearsOfExperience,
          currentTitle: patch.currentTitle,
          skills: patch.skills,
          preferredRoles: patch.preferredRoles,
          salaryExpectationVnd: patch.salaryExpectationVnd,
          availability: patch.availability,
        }
      });

      if (Object.keys(changes).length > 0) {
        await candidateProfileRepo.logChange({
          tenantId: input.tenantId,
          candidateProfileId: profile.id,
          changedFields: changes,
          changedBy: "zalo-worker",
        });

        // Query database client for other logs to check rapid changes
        const url = process.env.PLATFORM_DB_URL;
        if (url) {
          const client = createDatabaseClient({ PLATFORM_DB_URL: url });
          try {
            const recentLogs = await client.query(
              `SELECT changed_fields FROM public.candidate_profile_change_logs
               WHERE candidate_profile_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
              [profile.id]
            );

            let priorNameChange = false;
            let priorEmailChange = false;
            for (const r of recentLogs.rows) {
              const f = r.changed_fields;
              if (f.fullName) priorNameChange = true;
              if (f.email) priorEmailChange = true;
            }

            if (changes.fullName && priorNameChange) {
              await candidateProfileRepo.addRiskSignal({
                tenantId: input.tenantId,
                candidateProfileId: profile.id,
                ruleName: "rapid_name_updates",
                details: { reason: "Multiple name changes in 24 hours" },
                severity: "medium",
              });
            }

            if (changes.email && priorEmailChange) {
              await candidateProfileRepo.addRiskSignal({
                tenantId: input.tenantId,
                candidateProfileId: profile.id,
                ruleName: "rapid_email_updates",
                details: { reason: "Multiple email changes in 24 hours" },
                severity: "medium",
              });
            }

            if (changes.phone) {
              await candidateProfileRepo.addRiskSignal({
                tenantId: input.tenantId,
                candidateProfileId: profile.id,
                ruleName: "phone_updated",
                details: { oldPhone: changes.phone.old, newPhone: changes.phone.new },
                severity: "low",
              });
            }

            const assessment = await candidateProfileRepo.assessRisk({
              tenantId: input.tenantId,
              candidateProfileId: profile.id,
            });

            if (assessment.risk_score > 50) {
              console.warn(`[fraud-detection] Candidate ${profile.id} has high risk score (${assessment.risk_score}). Flagged!`);
            }
          } finally {
            await client.end();
          }
        }
      }

      return {
        created: false,
        profile: {
          externalUserId: input.externalUserId,
          displayName: profile.full_name || "",
          email: profile.email || "",
          phone: profile.phone || "",
          location: profile.location || "",
          yearsOfExperience: Number(profile.years_of_experience || 0),
          currentTitle: profile.current_title || "",
          skills: profile.skills || [],
          preferredRoles: profile.preferred_roles || [],
          salaryExpectationVnd: Number(profile.salary_expectation_vnd || 0),
          availability: profile.availability || "",
          notes: (profile.raw_extraction as any)?.notes || [],
        }
      };
    },
    addNote: async (input: { tenantId: string; channel: string; externalUserId: string; note: string; source?: string }) => {
      let contact = await contactsRepo.findByExternalUser({
        tenantId: input.tenantId,
        channel: input.channel,
        externalUserId: input.externalUserId,
      });
      if (!contact) {
        contact = await contactsRepo.createShadow({
          tenantId: input.tenantId,
          channel: input.channel,
          externalUserId: input.externalUserId,
        });
      }
      
      let existingNotes: string[] = [];
      const profile = await candidateProfileRepo.findByContact({
        tenantId: input.tenantId,
        contactId: contact.id,
      });
      if (profile && profile.raw_extraction && Array.isArray((profile.raw_extraction as any).notes)) {
        existingNotes = (profile.raw_extraction as any).notes;
      }
      
      const newNotes = [...existingNotes, input.note];
      const updatedProfile = await candidateProfileRepo.upsert({
        tenantId: input.tenantId,
        contactId: contact.id,
        patch: {
          rawExtraction: { notes: newNotes }
        }
      });
      
      return {
        created: false,
        note: {
          content: input.note,
          source: input.source,
          createdAt: new Date().toISOString(),
        },
        profile: {
          externalUserId: input.externalUserId,
          displayName: updatedProfile.full_name || "",
          email: updatedProfile.email || "",
          phone: updatedProfile.phone || "",
          location: updatedProfile.location || "",
          yearsOfExperience: Number(updatedProfile.years_of_experience || 0),
          currentTitle: updatedProfile.current_title || "",
          skills: updatedProfile.skills || [],
          preferredRoles: updatedProfile.preferred_roles || [],
          salaryExpectationVnd: Number(updatedProfile.salary_expectation_vnd || 0),
          availability: updatedProfile.availability || "",
          notes: newNotes,
        }
      };
    }
  } : undefined;

  const tools =
    options.skillMode === "twenty"
      ? createTwentyAgentTools(skillCache.skills)
      : createAgentTools(skillCache.skills, {
          loadJobs: jobsRepo
            ? {
                listJobs: async () => {
                  const rows = await jobsRepo.listActive({
                    tenantId: options.scenario.tenantId,
                  });
                  return rows.map(jobRowToPosting);
                },
              }
            : undefined,
          queryCompany: companyRepo
            ? {
                getCompany: async (name: string) => {
                  const row = await companyRepo.findByName({
                    tenantId: options.scenario.tenantId,
                    name,
                  });
                  if (!row) return null;
                  return {
                    name: row.name,
                    introduction: row.introduction,
                    benefits: row.benefits,
                    workStyle: row.work_style,
                    website: row.website,
                    leadership: row.leadership,
                    products: row.products,
                    materials: row.materials,
                    researchedAt: row.researched_at ? new Date(row.researched_at).toISOString() : null,
                  };
                },
              }
            : undefined,
          recordKnowledgeGap: getKnowledgeGapsRepo() && companyRepo
            ? {
                recordGap: async (input: {
                  question: string;
                  companyName?: string;
                  topic?: "company" | "job" | "process" | "benefits" | "other";
                }) => {
                  const tenantId = options.scenario.tenantId;
                  const conversationId = options.scenario.id;

                  let companyId: string | null = null;
                  if (input.companyName) {
                    const company = await companyRepo.findByName({
                      tenantId,
                      name: input.companyName,
                    });
                    if (company) {
                      companyId = company.id;
                    }
                  }

                  const { id, duplicate } = await getKnowledgeGapsRepo()!.record({
                    tenantId,
                    conversationId,
                    companyId,
                    question: input.question,
                    topic: input.topic,
                  });

                  return { id, duplicate };
                },
              }
            : undefined,
          candidateProfile: candidateProfileCtx,
          matchCandidate: (candidateProfileRepo && jobsRepo && contactsRepo)
            ? {
                getCandidateProfile: async () => {
                  const tenantId = options.scenario.tenantId;
                  const externalUserId = options.scenario.externalUserId;

                  const contact = await contactsRepo.findByExternalUser({
                    tenantId,
                    channel: "zalo",
                    externalUserId,
                  });
                  if (!contact) return null;

                  const profile = await candidateProfileRepo.findByContact({
                    tenantId,
                    contactId: contact.id,
                  });
                  if (!profile) return null;

                  return {
                    fullName: profile.full_name ?? undefined,
                    skills: profile.skills || [],
                    summary: profile.summary ?? undefined,
                  };
                },
                matchJobs: async (skills: string[], limit: number) => {
                  const tenantId = options.scenario.tenantId;
                  const rows = await jobsRepo.searchFts({
                    tenantId,
                    terms: skills,
                    limit,
                  });
                  return rows.map((r) => ({
                    id: r.id,
                    title: r.title,
                    company: r.company || "Công ty đối tác",
                    locationSlugs: r.location_slugs || [],
                    workMode: r.work_mode,
                    requiredSkills: r.required_skills || [],
                    description: r.description || "",
                    fts_rank: r.fts_rank,
                  }));
                },
              }
            : undefined,
          submitApplication: (jobsRepo && getApplicationsRepo() && contactsRepo && getGuestAccessRepo() && candidateProfileRepo)
            ? {
                submit: async (input: { jobId: string; note?: string }) => {
                  const tenantId = options.scenario.tenantId;
                  const externalUserId = options.scenario.externalUserId;

                  const job = await jobsRepo.findByIdOrExternalId({ tenantId, idOrExternalId: input.jobId });
                  if (!job) {
                    throw new Error(`Job posting with ID/Slug "${input.jobId}" was not found.`);
                  }

                  let contactId: string | null = null;
                  let guestAccessId: string | null = null;
                  let candidateProfileId: string | null = null;

                  const contact = await contactsRepo.findByExternalUser({
                    tenantId,
                    channel: "zalo",
                    externalUserId,
                  });
                  if (!contact) {
                    throw new Error(`Contact not found for user.`);
                  }
                  contactId = contact.id;

                  if (externalUserId.startsWith("guest-")) {
                    const inviteCode = externalUserId.substring("guest-".length);
                    const guestAccessRepo = getGuestAccessRepo()!;
                    const guest = await guestAccessRepo.findByInviteCode(inviteCode);
                    if (guest) {
                      guestAccessId = guest.id;
                    }
                  }

                  const profile = await candidateProfileRepo.findByContact({
                    tenantId,
                    contactId,
                  });
                  if (profile) {
                    candidateProfileId = profile.id;
                  }

                  const { application, created } = await getApplicationsRepo()!.submit({
                    tenantId,
                    jobPostingId: job.id,
                    contactId,
                    guestAccessId,
                    candidateProfileId,
                    appliedVia: "chat",
                    actorType: "candidate",
                    actorId: externalUserId,
                    note: input.note,
                  });

                  return {
                    applicationId: application.id,
                    created,
                    jobTitle: job.title,
                    companyName: job.company,
                  };
                },
              }
            : undefined,
          getApplicationStatus: (getApplicationsRepo() && contactsRepo && getGuestAccessRepo())
            ? {
                getStatus: async () => {
                  const tenantId = options.scenario.tenantId;
                  const externalUserId = options.scenario.externalUserId;

                  let contactId: string | null = null;
                  let guestAccessId: string | null = null;

                  const contact = await contactsRepo.findByExternalUser({
                    tenantId,
                    channel: "zalo",
                    externalUserId,
                  });
                  if (contact) {
                    contactId = contact.id;
                  }

                  if (externalUserId.startsWith("guest-")) {
                    const inviteCode = externalUserId.substring("guest-".length);
                    const guestAccessRepo = getGuestAccessRepo()!;
                    const guest = await guestAccessRepo.findByInviteCode(inviteCode);
                    if (guest) {
                      guestAccessId = guest.id;
                    }
                  }

                  const apps = await getApplicationsRepo()!.listByCandidate({
                    tenantId,
                    contactId,
                    guestAccessId,
                  });

                  return apps.map((app) => ({
                    jobTitle: app.job_title,
                    companyName: app.company_name,
                    stage: app.stage,
                    status: app.status,
                    updatedAt: app.updated_at,
                    lastNote: app.note,
                  }));
                },
              }
            : undefined,
        });

  const result = await generateText({
    model: createOpenRouterChatModel({
      model: options.model,
      enablePromptCaching: providerCache.enableProviderPromptCaching,
    }) as unknown as LanguageModel,
    system: promptContext.system,
    messages: promptContext.messages,
    tools,
    maxSteps: 8,
    maxTokens: 2000,
    temperature: 0.2,
    providerOptions: providerCache.providerOptions as ProviderMetadata,
    abortSignal: options.abortSignal,
    onStepFinish: async (step) => {
      if (options.onStepFinish) {
        await options.onStepFinish({
          text: step.text,
          toolCalls: step.toolCalls,
          toolResults: step.toolResults,
        });
      }
    },
  });

  return {
    scenarioId: options.scenario.id,
    assistantText: result.text,
    state,
    cache: {
      skillCache: skillCache.status,
      skillPromptHash: skillCache.hash,
      profileCache: profileCache.status,
      provider: readProviderCacheDiagnostics(result),
      prompt: promptContext.diagnostics,
    },
    steps: (result.steps ?? []).map((step: AgentStepResult) => ({
      text: step.text,
      toolCalls: step.toolCalls,
      toolResults: step.toolResults,
    })),
  };
}

export function clearHrAgentProfileCache() {
  customerProfileCache.clear();
}

function buildInitialState(options: HrAgentRunOptions): HrAgentState {
  const now = new Date().toISOString();

  return {
    tenantId: options.scenario.tenantId,
    channel: options.scenario.channel,
    threadId: options.scenario.threadId,
    externalUserId: options.scenario.externalUserId,
    version: 1,
    requirement: {},
    loadedSkills: [],
    history: options.scenario.messages.map((message) => ({
      role: message.externalUserId === "agent" ? "assistant" : "user",
      content: message.text,
      createdAt: message.receivedAt || now,
      metadata: {
        id: message.id,
        raw: message.raw,
      },
    })),
  };
}

function buildMockResult(input: {
  options: HrAgentRunOptions;
  state: HrAgentState;
  skillCache: SkillCacheResult;
  profileCacheStatus: "hit" | "miss" | "bypass";
  promptHash: string;
  promptDiagnostics: HrAgentRunResult["cache"]["prompt"];
}): HrAgentRunResult {
  const latestText = input.options.scenario.messages
    .map((message) => message.text)
    .join(" ");

  return {
    scenarioId: input.options.scenario.id,
    assistantText: `MOCK LLM: Mình đã nhận thông tin "${latestText}". Bạn cho mình thêm vai trò mong muốn và mức lương kỳ vọng nhé.`,
    state: input.state,
    cache: {
      skillCache: input.skillCache.status,
      skillPromptHash: input.promptHash,
      profileCache: input.profileCacheStatus,
      prompt: input.promptDiagnostics,
      provider: {
        mode: "mock",
      },
    },
    steps: [
      {
        text: "Mock run skipped provider call.",
        toolCalls: [],
        toolResults: [],
      },
    ],
  };
}

type AgentStepResult = {
  text?: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
};
