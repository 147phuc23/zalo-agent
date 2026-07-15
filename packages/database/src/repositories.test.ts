import { describe, it, expect, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createDatabaseClient } from "./index.js";
import { createJobPostingRepository } from "./repositories.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config();

describe("JobPostingRepository integration tests", () => {
  const url = process.env.PLATFORM_DB_URL;
  if (!url) {
    it.skip("Skip database integration tests because PLATFORM_DB_URL is not set", () => {});
    return;
  }

  const client = createDatabaseClient({ PLATFORM_DB_URL: url });
  const repo = createJobPostingRepository(client);
  const tenantId = "b545a6ca-eabe-4bb8-852d-2c497edb8e38"; // standard test tenant

  afterAll(async () => {
    await client.end();
  });

  it("should create a draft job and not return it in listActive, but return it after activation", async () => {
    // 1. Create a draft job
    const draft = await repo.createDraft({
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
    const activeJobs = await repo.listActive({ tenantId });
    const foundInActive = activeJobs.find(j => j.id === draft.id);
    expect(foundInActive).toBeUndefined();

    // 3. listByStatus('draft') should return the draft job
    const draftJobs = await repo.listByStatus({ tenantId, status: "draft" });
    const foundInDrafts = draftJobs.find(j => j.id === draft.id);
    expect(foundInDrafts).toBeDefined();
    expect(foundInDrafts?.title).toBe(draft.title);

    // 4. Update fields
    const updated = await repo.updateFields({
      id: draft.id,
      patch: {
        title: draft.title + " Updated",
        salaryMaxVnd: 25000000,
      }
    });
    expect(updated.title).toBe(draft.title + " Updated");
    expect(updated.salary_max_vnd).toBe(25000000);

    // 5. Activate the job
    await repo.setStatus({ id: draft.id, status: "active" });

    // 6. Now listActive should return the job
    const activeJobsAfter = await repo.listActive({ tenantId });
    const foundInActiveAfter = activeJobsAfter.find(j => j.id === draft.id);
    expect(foundInActiveAfter).toBeDefined();
    expect(foundInActiveAfter?.status).toBe("active");
    expect(foundInActiveAfter?.title).toBe(draft.title + " Updated");

    // Cleanup
    await client.query("DELETE FROM job_postings WHERE id = $1", [draft.id]);
  });
});
