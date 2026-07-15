import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock bullmq to avoid connecting to real Redis
vi.mock("bullmq", () => {
  return {
    Queue: class {
      add = vi.fn().mockResolvedValue({ id: "send-job-1" });
    },
    Worker: class {
      processFn: any;
      constructor(name: string, fn: any, opts: any) {
        this.processFn = fn;
      }
      on = vi.fn();
      close = vi.fn().mockResolvedValue(undefined);
    },
  };
});

// Mock ioredis to avoid connecting to real Redis
vi.mock("ioredis", () => {
  return {
    Redis: class {
      publish = vi.fn().mockResolvedValue(1);
    },
  };
});

const mockGetObject = vi.fn();
const mockPutObject = vi.fn();
const mockGetUploadTarget = vi.fn();
const mockPresignGet = vi.fn();

vi.mock("@platform/storage", () => {
  return {
    createStorage: () => ({
      getObject: mockGetObject,
      putObject: mockPutObject,
      getUploadTarget: mockGetUploadTarget,
      presignGet: mockPresignGet,
    }),
  };
});

const mockGenerate = vi.fn();
vi.mock("@platform/ai-client", () => {
  return {
    OpenRouterAiClient: class {
      generate = mockGenerate;
    },
  };
});

const mockTwentyClient = {
  updateCandidateProfile: vi.fn(),
  loadCandidateProfile: vi.fn(),
  computeJobMatchScores: vi.fn(),
};
vi.mock("../twenty/recruiting-client.js", () => {
  return {
    createTwentyRecruitingClientFromEnv: () => mockTwentyClient,
  };
});

import { startDocumentWorker } from "./document-processor.js";

describe("Document Processor Queue Worker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetObject.mockReset();
    mockPutObject.mockReset();
    mockGenerate.mockReset();
    mockTwentyClient.updateCandidateProfile.mockReset();
    mockTwentyClient.loadCandidateProfile.mockReset();
    mockTwentyClient.computeJobMatchScores.mockReset();
  });

  it("successfully parses and extracts a CV, creating a candidate profile and message", async () => {
    // 1. Setup doc mock data
    const documentId = "doc-cv-123";
    const tenantId = "tenant-abc";
    const mockDoc = {
      id: documentId,
      tenant_id: tenantId,
      kind: "cv",
      storage_key: "tenant-abc/cv/doc-cv-123/resume.txt",
      file_name: "resume.txt",
      mime_type: "text/plain",
      uploaded_by: "zalo",
      conversation_id: "conv-123",
      contact_id: "contact-123",
    };

    const mockRepos = {
      documents: {
        findById: vi.fn().mockResolvedValue(mockDoc),
        markProcessing: vi.fn().mockResolvedValue(undefined),
        markProcessed: vi.fn().mockResolvedValue(undefined),
        markFailed: vi.fn().mockResolvedValue(undefined),
      },
      candidateProfiles: {
        upsert: vi.fn().mockResolvedValue({ id: "profile-123" }),
      },
      jobPostings: {
        listActive: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            title: "Frontend Developer",
            company: "FPT",
            required_skills: ["React", "TypeScript"],
          },
        ]),
      },
      contacts: {
        findById: vi.fn().mockResolvedValue({
          id: "contact-123",
          external_user_id: "zalo-user-123",
        }),
      },
      conversations: {
        findById: vi.fn().mockResolvedValue({
          id: "conv-123",
          external_thread_id: "thread-123",
        }),
      },
      messages: {
        createOutbound: vi.fn().mockResolvedValue({
          id: "msg-out-123",
          tenant_id: tenantId,
          conversation_id: "conv-123",
          direction: "outbound",
          message_type: "text",
          text: "mocked response",
          idempotency_key: "key-123",
          is_read: false,
          created_at: new Date().toISOString(),
        }),
      },
    } as any;

    mockGetObject.mockResolvedValue(Buffer.from("This is a resume for Nguyen Van A. I know React, TypeScript, and Node.js."));
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        fullName: "Nguyen Van A",
        email: "a.nguyen@example.com",
        phone: "0901234567",
        location: "Hồ Chí Minh",
        currentTitle: "Frontend Developer",
        yearsOfExperience: 3,
        skills: ["React", "TypeScript"],
        preferredRoles: ["Frontend Developer"],
        salaryExpectationVnd: 20000000,
        availability: "Immediate",
        workHistory: [],
        education: [],
        languages: ["English"],
        summary: "Frontend dev",
      }),
    });

    const worker = startDocumentWorker({
      redisUrl: "redis://localhost:6379",
      repos: mockRepos,
    });

    // @ts-expect-error processFn is internal on Worker
    const handler = worker.processFn;
    expect(handler).toBeDefined();

    const result = await handler({
      id: "job-123",
      data: {
        tenantId,
        documentId,
      },
    } as any);

    // Verify marks
    expect(mockRepos.documents.findById).toHaveBeenCalledWith(documentId);
    expect(mockRepos.documents.markProcessing).toHaveBeenCalledWith(documentId);
    expect(mockRepos.documents.markProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        id: documentId,
        rawText: expect.stringContaining("Nguyen Van A"),
      })
    );

    // Verify profile upsert
    expect(mockRepos.candidateProfiles.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        contactId: "contact-123",
        patch: expect.objectContaining({
          fullName: "Nguyen Van A",
          skills: ["React", "TypeScript"],
        }),
      })
    );

    // Verify matching & outbound
    expect(mockRepos.messages.createOutbound).toHaveBeenCalled();

    await worker.close();
  });

  it("successfully parses a JD, creating a draft job posting", async () => {
    const documentId = "doc-jd-123";
    const tenantId = "tenant-abc";
    const mockDoc = {
      id: documentId,
      tenant_id: tenantId,
      kind: "jd",
      storage_key: "tenant-abc/jd/doc-jd-123/jd.txt",
      file_name: "jd.txt",
      mime_type: "text/plain",
      uploaded_by: "admin",
      company_id: "company-123",
    };

    const mockRepos = {
      documents: {
        findById: vi.fn().mockResolvedValue(mockDoc),
        markProcessing: vi.fn().mockResolvedValue(undefined),
        markProcessed: vi.fn().mockResolvedValue(undefined),
        markFailed: vi.fn().mockResolvedValue(undefined),
      },
      companies: {
        findById: vi.fn().mockResolvedValue({ id: "company-123", name: "FPT Software" }),
      },
      jobs: {
        createDraft: vi.fn().mockResolvedValue({ id: "job-draft-123" }),
      },
    } as any;

    mockGetObject.mockResolvedValue(Buffer.from("Job description for Backend Developer at FPT. Requires Node.js and SQL."));
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        title: "Backend Developer",
        company: "FPT Software",
        requiredSkills: ["Node.js", "SQL"],
        salaryMinVnd: 15000000,
        salaryMaxVnd: 30000000,
        workMode: "hybrid",
        seniority: "mid",
        jobType: "FULL_TIME",
        experienceRequiredYears: 2,
        benefits: "Lunch, 13th month salary",
        educationRequired: "Bachelor's",
        description: "Develop APIs",
        locationText: "Hồ Chí Minh",
      }),
    });

    const worker = startDocumentWorker({
      redisUrl: "redis://localhost:6379",
      repos: mockRepos,
    });

    // @ts-expect-error processFn is internal on Worker
    const handler = worker.processFn;
    expect(handler).toBeDefined();

    await handler({
      id: "job-456",
      data: {
        tenantId,
        documentId,
      },
    } as any);

    // Verify marks
    expect(mockRepos.documents.markProcessed).toHaveBeenCalled();
    
    // Verify draft creation
    expect(mockRepos.jobs.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        sourceDocumentId: documentId,
        fields: expect.objectContaining({
          title: "Backend Developer",
          company: "FPT Software",
          requiredSkills: ["Node.js", "SQL"],
        }),
      })
    );

    await worker.close();
  });
});
