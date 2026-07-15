import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDatabaseClient, createRepositorySet } from "./index.js";

const dbUrl = process.env.PLATFORM_DB_URL || "postgres://platform_user:platform_secure_pass@localhost:7432/platform";

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
