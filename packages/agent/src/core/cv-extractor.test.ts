import { vi, describe, it, expect, beforeEach } from "vitest";

const mockTwentyClient = {
  updateCandidateProfile: vi.fn(),
  loadCandidateProfile: vi.fn(),
  computeJobMatchScores: vi.fn(),
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

import { extractCvData, startCvWorker } from "./cv-extractor.js";
import { Queue } from "bullmq";

describe("CV Extractor & Worker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockTwentyClient.updateCandidateProfile.mockReset();
    mockTwentyClient.loadCandidateProfile.mockReset();
    mockTwentyClient.computeJobMatchScores.mockReset();
    mockGenerate.mockReset();
  });

  describe("extractCvData", () => {
    it("extracts frontend mock data based on filename", async () => {
      const result = await extractCvData("my-frontend-cv.pdf", "http://example.com/file");
      expect(result.displayName).toBe("Nguyễn Văn Frontend");
      expect(result.skills).toContain("React");
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it("extracts backend mock data based on filename", async () => {
      const result = await extractCvData(
        "backend_resume.docx",
        "http://example.com/file",
      );
      expect(result.displayName).toBe("Trần Văn Backend");
      expect(result.skills).toContain("NodeJS");
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it("calls OpenRouter for general CV parsing", async () => {
      mockGenerate.mockResolvedValue({
        text: JSON.stringify({
          displayName: "Lê Văn General",
          skills: ["Java", "SQL"],
          preferredRoles: ["Java Developer"],
        }),
        model: "tencent/hy3:free",
      });

      const result = await extractCvData("cv_general.pdf", "http://example.com/file");
      expect(result.displayName).toBe("Lê Văn General");
      expect(result.skills).toEqual(["Java", "SQL"]);
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });
  });

  describe("startCvWorker", () => {
    it("runs the CV worker job flow", async () => {
      // Mock CRM responses
      mockTwentyClient.loadCandidateProfile.mockResolvedValue({
        externalUserId: "zalo-user-1",
        displayName: "Nguyễn Văn Frontend",
        skills: ["React"],
        preferredRoles: ["Frontend Engineer"],
      });
      mockTwentyClient.computeJobMatchScores.mockResolvedValue([
        {
          job: { id: "job-1", title: "Frontend Engineer", company: "Company A" },
          score: 8,
          reasons: ["React matches"],
        },
      ]);

      // Mock database repository
      const mockRepos = {
        conversations: {
          findById: vi.fn().mockResolvedValue({
            id: "conv-1",
            external_thread_id: "thread-123",
          }),
        },
        messages: {
          createOutbound: vi.fn().mockResolvedValue({
            id: "msg-out-123",
            tenant_id: "tenant-1",
            conversation_id: "conv-1",
            direction: "outbound",
            message_type: "text",
            text: "mocked text",
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
        add: vi.fn().mockResolvedValue({ id: "send-job-1" }),
      } as unknown as Queue;

      // Start the worker (this instantiates the BullMQ worker)
      const worker = startCvWorker({
        redisUrl: "redis://127.0.0.1:6379",
        repos: mockRepos,
        redisPublisher: mockRedisPublisher,
        messageSendQueue: mockMessageSendQueue,
      });

      // Directly invoke the job handler function
      // @ts-expect-error processFn is internal on Worker
      const handler = worker.processFn;
      expect(handler).toBeDefined();

      const jobResult = await handler({
        id: "job-123",
        data: {
          tenantId: "tenant-1",
          conversationId: "conv-1",
          externalUserId: "zalo-user-1",
          fileUrl: "http://example.com/my-frontend-cv.pdf",
          fileName: "my-frontend-cv.pdf",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      expect(jobResult.ok).toBe(true);
      expect(jobResult.matchesCount).toBe(1);

      // Verify CRM operations
      expect(mockTwentyClient.updateCandidateProfile).toHaveBeenCalledWith({
        externalUserId: "zalo-user-1",
        patch: expect.objectContaining({
          displayName: "Nguyễn Văn Frontend",
          skills: expect.arrayContaining(["React"]),
        }),
      });

      // Verify DB / Messaging calls
      expect(mockRepos.conversations.findById).toHaveBeenCalledWith("conv-1");
      expect(mockRepos.messages.createOutbound).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          conversationId: "conv-1",
          messageType: "text",
          text: expect.stringContaining("Nguyễn Văn Frontend"),
        }),
      );
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        "platform:sse",
        expect.any(String),
      );
      expect(mockMessageSendQueue.add).toHaveBeenCalledWith(
        "message.send",
        expect.objectContaining({
          tenantId: "tenant-1",
          threadId: "thread-123",
          text: expect.stringContaining("Nguyễn Văn Frontend"),
        }),
        expect.any(Object),
      );

      // Clean up worker connection to avoid leaving handle open
      await worker.close();
    });
  });
});
