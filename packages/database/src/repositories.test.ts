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
        salaryMaxVnd: 25000000,
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
