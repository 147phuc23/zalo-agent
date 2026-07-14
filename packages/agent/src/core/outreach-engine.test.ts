import { vi, describe, it, expect, beforeEach } from "vitest";

const mockTwentyClient = {
  updateCandidateProfile: vi.fn(),
  loadCandidateProfile: vi.fn(),
  computeJobMatchScores: vi.fn(),
  getCandidateRecruitingStatus: vi.fn(),
  listInProgressApplications: vi.fn(),
};

const mockGenerate = vi.fn();

vi.mock("../twenty/recruiting-client.js", () => {
  return {
    createTwentyRecruitingClientFromEnv: () => mockTwentyClient,
  };
});

vi.mock("@platform/ai-client", () => {
  return {
    OpenRouterAiClient: class {
      generate = mockGenerate;
    },
  };
});

import {
  generateFollowUpMessage,
  generateJobOutreachMessage,
  generateUrgentOutreachMessage,
  runPipelineFollowUpsCampaign,
  runReverseMatchingCampaign,
  runUrgentJobCampaign,
} from "./outreach-engine.js";
import { Queue } from "bullmq";

describe("Outreach Campaign Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockTwentyClient.getCandidateRecruitingStatus.mockReset();
    mockTwentyClient.listInProgressApplications.mockReset();
    mockTwentyClient.loadCandidateProfile.mockReset();
    mockTwentyClient.computeJobMatchScores.mockReset();
    mockGenerate.mockReset();
  });

  describe("Message Generators", () => {
    it("generates follow up check-in message", async () => {
      mockGenerate.mockResolvedValue({ text: "Mocked follow-up text" });
      const result = await generateFollowUpMessage("John", "React Dev");
      expect(result).toBe("Mocked follow-up text");
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    it("generates reverse job outreach message", async () => {
      mockGenerate.mockResolvedValue({ text: "Mocked match text" });
      const result = await generateJobOutreachMessage("John", "React Dev", "Comp A");
      expect(result).toBe("Mocked match text");
    });

    it("generates urgent campaign outreach message", async () => {
      mockGenerate.mockResolvedValue({ text: "Mocked urgent text" });
      const result = await generateUrgentOutreachMessage("John", "React Dev", "Comp A");
      expect(result).toBe("Mocked urgent text");
    });
  });

  describe("runPipelineFollowUpsCampaign", () => {
    it("outreaches to candidates stuck in screening/interviewing", async () => {
      // Setup mock DB conversation query
      const mockDb = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: "conv-1",
              tenant_id: "tenant-1",
              external_thread_id: "thread-123",
              contact_id: "contact-1",
            },
          ],
        }),
      };

      const mockRepos = {
        contacts: {
          listByIds: vi
            .fn()
            .mockResolvedValue([
              {
                id: "contact-1",
                external_user_id: "zalo-user-1",
                display_name: "John Doe",
              },
            ]),
        },
        messages: {
          createOutbound: vi.fn().mockResolvedValue({
            id: "msg-out-123",
            tenant_id: "tenant-1",
            conversation_id: "conv-1",
            direction: "outbound",
            message_type: "text",
            text: "Followup text",
            idempotency_key: "key-123",
            is_read: false,
            created_at: new Date().toISOString(),
          }),
        },
      };

      const mockRedisPublisher = {
        publish: vi.fn().mockResolvedValue(1),
      };

      const mockMessageSendQueue = {
        add: vi.fn().mockResolvedValue({ id: "job-id" }),
      } as unknown as Queue;

      // Mock CRM responses
      mockTwentyClient.getCandidateRecruitingStatus.mockResolvedValue({
        personFound: true,
        pipelineStage: "screening",
      });
      mockTwentyClient.listInProgressApplications.mockResolvedValue([
        {
          job: { title: "Senior React Engineer" },
        },
      ]);
      mockGenerate.mockResolvedValue({
        text: "Xin chào John Doe! Bạn có cập nhật gì mới không?",
      });

      const count = await runPipelineFollowUpsCampaign({
        db: mockDb,
        repos: mockRepos,
        redisPublisher: mockRedisPublisher,
        messageSendQueue: mockMessageSendQueue,
      });

      expect(count).toBe(1);
      expect(mockTwentyClient.getCandidateRecruitingStatus).toHaveBeenCalledWith({
        externalUserId: "zalo-user-1",
      });
      expect(mockRepos.messages.createOutbound).toHaveBeenCalled();
      expect(mockRedisPublisher.publish).toHaveBeenCalled();
      expect(mockMessageSendQueue.add).toHaveBeenCalled();
    });
  });

  describe("runReverseMatchingCampaign", () => {
    it("outreaches for high match scores", async () => {
      const mockDb = {
        query: vi
          .fn()
          // First query: fetch tenant contacts
          .mockResolvedValueOnce({
            rows: [
              {
                id: "contact-1",
                external_user_id: "zalo-user-1",
                display_name: "John Doe",
              },
            ],
          })
          // Second query: fetch conversation for contact
          .mockResolvedValueOnce({
            rows: [{ id: "conv-1", external_thread_id: "thread-123" }],
          }),
      };

      const mockRepos = {
        messages: {
          createOutbound: vi.fn().mockResolvedValue({
            id: "msg-out-123",
            tenant_id: "tenant-1",
            conversation_id: "conv-1",
            direction: "outbound",
            message_type: "text",
            text: "Outreach text",
            idempotency_key: "key-123",
            is_read: false,
            created_at: new Date().toISOString(),
          }),
        },
      };

      const mockRedisPublisher = {
        publish: vi.fn().mockResolvedValue(1),
      };

      const mockMessageSendQueue = {
        add: vi.fn().mockResolvedValue({ id: "job-id" }),
      } as unknown as Queue;

      const mockJob = {
        id: "job-posting-1",
        title: "NodeJS Developer",
        company: "Company X",
        locationSlugs: ["ha-noi"],
        workMode: "remote" as const,
        salaryMinVnd: 40000000,
        salaryMaxVnd: 60000000,
        seniority: "senior",
        requiredSkills: ["NodeJS"],
        description: "description",
      };

      // Mock CRM match scores
      mockTwentyClient.loadCandidateProfile.mockResolvedValue({
        externalUserId: "zalo-user-1",
        displayName: "John Doe",
        skills: ["NodeJS"],
        preferredRoles: [],
      });
      mockTwentyClient.computeJobMatchScores.mockResolvedValue([
        {
          job: mockJob,
          score: 9,
          reasons: ["Strong match"],
        },
      ]);
      mockGenerate.mockResolvedValue({
        text: "Chào John Doe, mình thấy việc này phù hợp với bạn!",
      });

      const count = await runReverseMatchingCampaign({
        job: mockJob,
        tenantId: "tenant-1",
        db: mockDb,
        repos: mockRepos,
        redisPublisher: mockRedisPublisher,
        messageSendQueue: mockMessageSendQueue,
      });

      expect(count).toBe(1);
      expect(mockRepos.messages.createOutbound).toHaveBeenCalled();
    });
  });

  describe("runUrgentJobCampaign", () => {
    it("outreaches for relaxed match scores", async () => {
      const mockDb = {
        query: vi
          .fn()
          .mockResolvedValueOnce({
            rows: [
              { id: "contact-2", external_user_id: "zalo-user-2", display_name: "Alice" },
            ],
          })
          .mockResolvedValueOnce({
            rows: [{ id: "conv-2", external_thread_id: "thread-456" }],
          }),
      };

      const mockRepos = {
        messages: {
          createOutbound: vi.fn().mockResolvedValue({
            id: "msg-out-456",
            tenant_id: "tenant-1",
            conversation_id: "conv-2",
            direction: "outbound",
            message_type: "text",
            text: "Urgent text",
            idempotency_key: "key-456",
            is_read: false,
            created_at: new Date().toISOString(),
          }),
        },
      };

      const mockRedisPublisher = {
        publish: vi.fn().mockResolvedValue(1),
      };

      const mockMessageSendQueue = {
        add: vi.fn().mockResolvedValue({ id: "job-id" }),
      } as unknown as Queue;

      const mockJob = {
        id: "job-posting-2",
        title: "DevOps Engineer",
        company: "Company Y",
        locationSlugs: ["ho-chi-minh-city"],
        workMode: "hybrid" as const,
        salaryMinVnd: 50000000,
        salaryMaxVnd: 70000000,
        seniority: "senior",
        requiredSkills: ["AWS"],
        description: "description",
      };

      // Mock CRM matches
      mockTwentyClient.loadCandidateProfile.mockResolvedValue({
        externalUserId: "zalo-user-2",
        displayName: "Alice",
        skills: ["AWS"],
        preferredRoles: [],
      });
      mockTwentyClient.computeJobMatchScores.mockResolvedValue([
        {
          job: mockJob,
          score: 6, // Widen talent pool (>= 6)
          reasons: ["Mid match"],
        },
      ]);
      mockGenerate.mockResolvedValue({ text: "Tuyển khẩn cấp vị trí DevOps!" });

      const count = await runUrgentJobCampaign({
        job: mockJob,
        tenantId: "tenant-1",
        db: mockDb,
        repos: mockRepos,
        redisPublisher: mockRedisPublisher,
        messageSendQueue: mockMessageSendQueue,
      });

      expect(count).toBe(1);
    });
  });
});
