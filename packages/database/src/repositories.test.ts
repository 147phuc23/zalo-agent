import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createDatabaseClient, createRepositorySet } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config();

const dbUrl = process.env.PLATFORM_DB_URL || "postgres://platform_user:platform_secure_pass@localhost:7432/platform";

describe("JobPostingRepository integration tests", () => {
  const url = process.env.PLATFORM_DB_URL;
  if (!url) {
    it.skip("Skip database integration tests because PLATFORM_DB_URL is not set", () => {});
    return;
  }

  const client = createDatabaseClient({ PLATFORM_DB_URL: url });
  const repos = createRepositorySet(client);
  const tenantId = "b545a6ca-eabe-4bb8-852d-2c497edb8e38"; // standard test tenant

  afterAll(async () => {
    await client.end();
  });

  it("should create a draft job and not return it in listActive, but return it after activation", async () => {
    // 1. Create a draft job
    const draft = await repos.jobs.createDraft({
      tenantId,
      sourceDocumentId: null,
      fields: {
        title: "Test Draft Job " + Date.now(),
        company: "Test Integration Co",
        locationSlugs: ["remote"],
        workMode: "remote",
        salaryMinVnd: 10000000,
        salaryMaxVnd: 20000000,
        seniority: "senior",
        requiredSkills: ["Testing", "Vitest"],
        description: "Testing our draft-to-active visibility flow",
      }
    });

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe("draft");

    // 2. listActive should NOT return the draft job
    const activeJobs = await repos.jobs.listActive({ tenantId });
    const foundInActive = activeJobs.find(j => j.id === draft.id);
    expect(foundInActive).toBeUndefined();

    // 3. listByStatus('draft') should return the draft job
    const draftJobs = await repos.jobs.listByStatus({ tenantId, status: "draft" });
    const foundInDrafts = draftJobs.find(j => j.id === draft.id);
    expect(foundInDrafts).toBeDefined();
    expect(foundInDrafts?.title).toBe(draft.title);

    // 4. Update fields
    const updated = await repos.jobs.updateFields({
      id: draft.id,
      patch: {
        title: draft.title + " Updated",
        salary_max_vnd: 25000000,
      }
    });
    expect(updated.title).toBe(draft.title + " Updated");
    expect(updated.salary_max_vnd).toBe(25000000);

    // 5. Activate the job
    await repos.jobs.setStatus({ id: draft.id, status: "active" });

    // 6. Now listActive should return the job
    const activeJobsAfter = await repos.jobs.listActive({ tenantId });
    const foundInActiveAfter = activeJobsAfter.find(j => j.id === draft.id);
    expect(foundInActiveAfter).toBeDefined();
    expect(foundInActiveAfter?.status).toBe("active");
    expect(foundInActiveAfter?.title).toBe(draft.title + " Updated");

    // Cleanup
    await client.query("DELETE FROM job_postings WHERE id = $1", [draft.id]);
  });

  it("should find active job postings using FTS", async () => {
    // 1. Create dummy company
    const companyId = await repos.companies.ensureExists({
      tenantId,
      name: "FTS Company Tech",
    });

    // 2. Create active job posting
    const job = await repos.jobs.createDraft({
      tenantId,
      sourceDocumentId: null,
      fields: {
        title: "Senior Rust Developer",
        company: "FTS Company Tech",
        locationSlugs: ["remote"],
        workMode: "remote",
        salaryMinVnd: 40000000,
        salaryMaxVnd: 70000000,
        seniority: "senior",
        requiredSkills: ["Rust", "Tokio", "Postgres"],
        description: "Looking for an expert developer to scale systems using Rust.",
      }
    });

    await repos.jobs.setStatus({ id: job.id, status: "active" });

    // 3. Search for "rust"
    const results = await repos.jobs.searchFts({
      tenantId,
      terms: ["rust", "developer"],
    });

    expect(results.length).toBeGreaterThan(0);
    const match = results.find(r => r.id === job.id);
    expect(match).toBeDefined();
    expect(match?.title).toBe("Senior Rust Developer");
    expect(match?.fts_rank).toBeGreaterThan(0);

    // Cleanup
    await client.query("DELETE FROM job_postings WHERE id = $1", [job.id]);
    await client.query("DELETE FROM companies WHERE id = $1", [companyId]);
  });
});

describe("Candidate Profile Repository", () => {
  let client: any;
  let repos: any;
  const tenantId = "22222222-2222-2222-2222-222222222222";
  let contactId: string;
  let guestAccessId: string;

  beforeAll(async () => {
    client = createDatabaseClient({ PLATFORM_DB_URL: dbUrl });
    repos = createRepositorySet(client);
    
    // Seed a tenant
    await repos.tenants.ensureExists({
      tenantId,
      name: "Test Tenant",
      timezone: "Asia/Ho_Chi_Minh",
      locale: "vi",
    });

    // Create a contact
    const contact = await repos.contacts.createShadow({
      tenantId,
      channel: "zalo",
      externalUserId: "test-user-123",
      displayName: "Jane Doe",
    });
    contactId = contact.id;

    // Create a guest access
    const guest = await repos.guestAccess.create({
      tenantId,
      inviteCode: "test-code-abc",
    });
    guestAccessId = guest.id;
  });

  afterAll(async () => {
    // Cleanup
    await client.query("DELETE FROM candidate_profiles WHERE tenant_id = $1", [tenantId]);
    await client.query("DELETE FROM guest_access WHERE tenant_id = $1", [tenantId]);
    await client.query("DELETE FROM contacts WHERE tenant_id = $1", [tenantId]);
    await client.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
    await client.end();
  });

  it("should fail upsert if both contact_id and guest_access_id are null", async () => {
    await expect(
      repos.candidateProfiles.upsert({
        tenantId,
        patch: {
          fullName: "No Owner",
        },
      })
    ).rejects.toThrow();
  });

  it("should create, read, merge upsert, and search candidate profiles", async () => {
    // 1. Create candidate profile
    const profile = await repos.candidateProfiles.upsert({
      tenantId,
      contactId,
      patch: {
        fullName: "Nguyen Van A",
        email: "a.nguyen@example.com",
        skills: ["React", "TypeScript", "Node.js"],
        yearsOfExperience: 3.5,
        summary: "An experienced React developer.",
        rawExtraction: { initial: true, notes: ["note 1"] },
      },
    });

    expect(profile.full_name).toBe("Nguyen Van A");
    expect(profile.skills).toEqual(["React", "TypeScript", "Node.js"]);
    expect(Number(profile.years_of_experience)).toBe(3.5);

    // 2. Find by contact
    const foundContact = await repos.candidateProfiles.findByContact({ tenantId, contactId });
    expect(foundContact).not.toBeNull();
    expect(foundContact!.id).toBe(profile.id);

    // 3. Merging upsert
    const updated = await repos.candidateProfiles.upsert({
      tenantId,
      contactId,
      patch: {
        fullName: "Nguyen Van A Updated",
        skills: ["React", "TypeScript", "Node.js", "GraphQL"],
        rawExtraction: { updated: true }, // should merge with existing notes
      },
    });

    expect(updated.full_name).toBe("Nguyen Van A Updated");
    expect(updated.email).toBe("a.nguyen@example.com"); // remains unchanged
    expect(updated.skills).toEqual(["React", "TypeScript", "Node.js", "GraphQL"]); // replaced
    expect(updated.raw_extraction).toEqual({ initial: true, updated: true, notes: ["note 1"] }); // deep merged & notes preserved!

    // 4. Search
    const searchRes1 = await repos.candidateProfiles.search({
      tenantId,
      query: "developer",
    });
    expect(searchRes1.length).toBe(1);
    expect(searchRes1[0].id).toBe(profile.id);

    const searchRes2 = await repos.candidateProfiles.search({
      tenantId,
      skills: ["GraphQL"],
    });
    expect(searchRes2.length).toBe(1);

    const searchRes3 = await repos.candidateProfiles.search({
      tenantId,
      skills: ["Python"],
    });
    expect(searchRes3.length).toBe(0);
  });
});

describe("Application Repository integration tests", () => {
  const url = process.env.PLATFORM_DB_URL;
  if (!url) {
    it.skip("Skip database integration tests because PLATFORM_DB_URL is not set", () => {});
    return;
  }

  const client = createDatabaseClient({ PLATFORM_DB_URL: url });
  const repos = createRepositorySet(client);
  const tenantId = "b545a6ca-eabe-4bb8-852d-2c497edb8e38";

  afterAll(async () => {
    await client.end();
  });

  it("should handle application submission, idempotency, and transitions", async () => {
    // Setup a dummy job
    const job = await repos.jobs.createDraft({
      tenantId,
      sourceDocumentId: null,
      fields: {
        title: "Test Application Job",
        company: "Test Applications Inc",
        locationSlugs: ["onsite"],
        workMode: "onsite",
        salaryMinVnd: 5000000,
        salaryMaxVnd: 10000000,
        seniority: "junior",
        requiredSkills: ["Git"],
        description: "A job to test applications",
      }
    });
    await repos.jobs.setStatus({ id: job.id, status: "active" });

    // Setup a dummy contact
    const contact = await repos.contacts.createShadow({
      tenantId,
      channel: "zalo",
      externalUserId: "appl-contact-" + Date.now(),
      displayName: "John Applicant",
    });

    // 1. Submit application
    const { application, created } = await repos.applications.submit({
      tenantId,
      jobPostingId: job.id,
      contactId: contact.id,
      appliedVia: "chat",
      actorType: "candidate",
      note: "I am interested",
    });

    expect(created).toBe(true);
    expect(application.stage).toBe("submitted");
    expect(application.status).toBe("active");

    // Verify initial event
    const events = await repos.applications.listEvents(application.id);
    expect(events.length).toBe(1);
    expect(events[0].to_stage).toBe("submitted");
    expect(events[0].to_status).toBe("active");

    // 2. Submit again (idempotency check)
    const { application: dupApp, created: dupCreated } = await repos.applications.submit({
      tenantId,
      jobPostingId: job.id,
      contactId: contact.id,
      appliedVia: "chat",
      actorType: "candidate",
    });

    expect(dupCreated).toBe(false);
    expect(dupApp.id).toBe(application.id);

    // 3. Valid stage transition
    const transitioned = await repos.applications.transition({
      applicationId: application.id,
      toStage: "screening",
      actorType: "admin",
      note: "Screening this candidate",
    });

    expect(transitioned.stage).toBe("screening");
    expect(transitioned.status).toBe("active");

    // Verify event appended
    const eventsAfter = await repos.applications.listEvents(application.id);
    expect(eventsAfter.length).toBe(2);
    expect(eventsAfter[1].from_stage).toBe("submitted");
    expect(eventsAfter[1].to_stage).toBe("screening");
    expect(eventsAfter[1].note).toBe("Screening this candidate");

    // 4. Invalid stage transition (backward)
    await expect(
      repos.applications.transition({
        applicationId: application.id,
        toStage: "submitted",
        actorType: "admin",
      })
    ).rejects.toThrow();

    // 5. Transition to terminal status
    const rejected = await repos.applications.transition({
      applicationId: application.id,
      toStatus: "rejected",
      actorType: "admin",
      note: "Not a good fit",
    });
    expect(rejected.status).toBe("rejected");

    // 6. Transition after terminal status should fail
    await expect(
      repos.applications.transition({
        applicationId: application.id,
        toStage: "interviewing",
        actorType: "admin",
      })
    ).rejects.toThrow();

    // Cleanup
    await client.query("DELETE FROM application_events WHERE application_id = $1", [application.id]);
    await client.query("DELETE FROM applications WHERE id = $1", [application.id]);
    await client.query("DELETE FROM contacts WHERE id = $1", [contact.id]);
    await client.query("DELETE FROM job_postings WHERE id = $1", [job.id]);
  });
});

describe("Knowledge Gaps and Company Sources Repository integration tests", () => {
  const url = process.env.PLATFORM_DB_URL;
  if (!url) {
    it.skip("Skip database integration tests because PLATFORM_DB_URL is not set", () => {});
    return;
  }

  const client = createDatabaseClient({ PLATFORM_DB_URL: url });
  const repos = createRepositorySet(client);
  const tenantId = "b545a6ca-eabe-4bb8-852d-2c497edb8e38";

  afterAll(async () => {
    await client.end();
  });

  it("should record knowledge gaps with deduplication and update status", async () => {
    const question = "What is the benefits at Company Test?";

    // 1. Record gap 1
    const res1 = await repos.knowledgeGaps.record({
      tenantId,
      question,
      topic: "benefits",
    });
    expect(res1.duplicate).toBe(false);
    expect(res1.id).toBeDefined();

    // 2. Record same gap (deduplication check)
    const res2 = await repos.knowledgeGaps.record({
      tenantId,
      question,
      topic: "benefits",
    });
    expect(res2.duplicate).toBe(true);
    expect(res2.id).toBe(res1.id);

    // Verify database row
    const openGaps = await repos.knowledgeGaps.listOpen({ tenantId });
    const match = openGaps.find(g => g.id === res1.id);
    expect(match).toBeDefined();
    expect(match?.ask_count).toBe(2);

    // 3. Mark answered
    await repos.knowledgeGaps.markAnswered({
      id: res1.id,
      answer: "We offer full health insurance.",
    });

    const openGapsAfter = await repos.knowledgeGaps.listOpen({ tenantId });
    expect(openGapsAfter.some(g => g.id === res1.id)).toBe(false);

    // Cleanup
    await client.query("DELETE FROM public.knowledge_gaps WHERE id = $1", [res1.id]);
  });

  it("should replace company sources", async () => {
    // Setup a dummy company
    const companyId = await repos.companies.ensureExists({
      tenantId,
      name: "Dummy Source Corp",
    });

    const sources = [
      { url: "https://dummycorp.com/about", kind: "about" as const, title: "About Us" },
      { url: "https://dummycorp.com/products", kind: "products" as const, title: "Our Products" },
    ];

    const { inserted } = await repos.companySources.replaceForCompany({
      tenantId,
      companyId,
      sources,
    });
    expect(inserted).toBe(2);

    const list = await repos.companySources.listByCompany({ tenantId, companyId });
    expect(list.length).toBe(2);
    expect(list[0].kind).toBe("about");
    expect(list[1].kind).toBe("products");

    // Cleanup
    await client.query("DELETE FROM public.company_sources WHERE company_id = $1", [companyId]);
    await client.query("DELETE FROM public.companies WHERE id = $1", [companyId]);
  });
});

describe("Candidate Risk and Fraud Detection integration tests", () => {
  const url = process.env.PLATFORM_DB_URL;
  if (!url) {
    it.skip("Skip database integration tests because PLATFORM_DB_URL is not set", () => {});
    return;
  }

  const client = createDatabaseClient({ PLATFORM_DB_URL: url });
  const repos = createRepositorySet(client);
  const tenantId = "b545a6ca-eabe-4bb8-852d-2c497edb8e38";

  afterAll(async () => {
    await client.end();
  });

  it("should track change logs, risk signals, and compute risk score", async () => {
    // 1. Create a candidate contact & profile
    const contact = await repos.contacts.createShadow({
      tenantId,
      channel: "zalo",
      externalUserId: "zalo-user-risk-123",
      displayName: "John Risk",
    });
    const contactId = contact.id;

    const profile = await repos.candidateProfiles.upsert({
      tenantId,
      contactId,
      patch: {
        fullName: "John Risk Original",
        email: "john.risk@example.com",
        skills: ["React"],
      },
    });

    // Verify initial risk score is 0
    expect(profile.risk_score).toBe(0);
    expect(profile.flagged_at).toBeNull();

    // 2. Log a profile change (worth 10 points)
    await repos.candidateProfiles.logChange({
      tenantId,
      candidateProfileId: profile.id,
      changedFields: {
        fullName: { old: "John Risk Original", new: "John Risk Impostor" },
      },
      changedBy: "zalo-worker",
    });

    // 3. Add a medium severity risk signal (worth 15 points)
    await repos.candidateProfiles.addRiskSignal({
      tenantId,
      candidateProfileId: profile.id,
      ruleName: "rapid_name_updates",
      details: { reason: "Changed name twice in 5 mins" },
      severity: "medium",
    });

    // 4. Assess risk -> Score should be 10 (change) + 15 (signal) = 25
    let assessment = await repos.candidateProfiles.assessRisk({
      tenantId,
      candidateProfileId: profile.id,
    });

    expect(assessment.risk_score).toBe(25);
    expect(assessment.flagged_at).toBeNull();

    // 5. Add a high severity risk signal (worth 30 points) -> Total 25 + 30 = 55 (> 50, triggers flagging)
    await repos.candidateProfiles.addRiskSignal({
      tenantId,
      candidateProfileId: profile.id,
      ruleName: "multi_contact_phone",
      details: { phones: ["+84900000000", "+84911111111"] },
      severity: "high",
    });

    assessment = await repos.candidateProfiles.assessRisk({
      tenantId,
      candidateProfileId: profile.id,
    });

    expect(assessment.risk_score).toBe(55);
    expect(assessment.flagged_at).not.toBeNull();

    // Cleanup
    await client.query("DELETE FROM public.candidate_profile_change_logs WHERE candidate_profile_id = $1", [profile.id]);
    await client.query("DELETE FROM public.risk_signals WHERE candidate_profile_id = $1", [profile.id]);
    await client.query("DELETE FROM public.candidate_profiles WHERE id = $1", [profile.id]);
    await client.query("DELETE FROM public.contacts WHERE id = $1", [contactId]);
  });
});
