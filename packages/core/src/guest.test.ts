import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import {
  createInvite,
  claimInvite,
  loginGuest,
  verifyGuestSession,
  listGuestMessages,
  sendGuestMessage,
  hashPassword,
} from "./guest.js";

// Mock the ingest and reply flows to keep tests unit-scoped and fast
vi.mock("./ingest.js", () => ({
  ingestInboundMessage: vi.fn().mockResolvedValue({
    status: "stored",
    conversationId: "conv-123",
    messageId: "msg-123",
  }),
}));

vi.mock("./reply.js", () => ({
  generateAndSaveReply: vi.fn().mockResolvedValue([]),
}));

describe("guest chat access logic", () => {
  let mockRepos: any;

  beforeEach(() => {
    mockRepos = {
      guestAccess: {
        create: vi.fn(),
        findByInviteCode: vi.fn(),
        updateClaim: vi.fn(),
        updateSessionToken: vi.fn(),
        updateLastSeen: vi.fn(),
      },
      tenants: {
        ensureExists: vi.fn().mockResolvedValue(undefined),
      },
      contacts: {
        createShadow: vi.fn().mockResolvedValue({ id: "contact-123" }),
      },
      conversations: {
        create: vi.fn().mockResolvedValue({ id: "conv-123" }),
      },
      messages: {
        listByConversation: vi.fn().mockResolvedValue([]),
      },
    };
  });

  it("createInvite should generate a secure invite code and store in DB", async () => {
    mockRepos.guestAccess.create.mockImplementation((input: any) => ({
      id: "guest-id-123",
      tenant_id: input.tenantId,
      invite_code: input.inviteCode,
      status: "pending",
    }));

    const result = await createInvite(mockRepos, { tenantId: "tenant-123" });

    expect(result.id).toBe("guest-id-123");
    expect(result.tenant_id).toBe("tenant-123");
    expect(result.status).toBe("pending");
    expect(result.invite_code).toBeDefined();
    expect(result.invite_code.length).toBeGreaterThan(10);
    expect(mockRepos.guestAccess.create).toHaveBeenCalledOnce();
  });

  it("claimInvite should claim a pending invite and return the raw secret", async () => {
    const mockGuest = {
      id: "guest-id-123",
      tenant_id: "tenant-123",
      invite_code: "code-123",
      status: "pending",
    };
    mockRepos.guestAccess.findByInviteCode.mockResolvedValue(mockGuest);
    mockRepos.guestAccess.updateClaim.mockResolvedValue({
      ...mockGuest,
      status: "claimed",
      display_name: "John Doe",
      contact_id: "contact-123",
      conversation_id: "conv-123",
    });

    const result = await claimInvite(mockRepos, {
      inviteCode: "code-123",
      password: "securepassword",
      displayName: "John Doe",
      profile: { desiredRole: "Developer" },
    });

    expect(result.guest.status).toBe("claimed");
    expect(result.guest.display_name).toBe("John Doe");
    expect(result.secret).toBeDefined();
    expect(result.secret.length).toBeGreaterThan(16);
    expect(mockRepos.contacts.createShadow).toHaveBeenCalledOnce();
    expect(mockRepos.conversations.create).toHaveBeenCalledOnce();
    expect(mockRepos.guestAccess.updateClaim).toHaveBeenCalledOnce();
  });

  it("loginGuest should verify password and return a new session secret", async () => {
    const passwordHashVal = await hashPassword("mypassword");
    const mockGuest = {
      id: "guest-id-123",
      tenant_id: "tenant-123",
      invite_code: "code-123",
      status: "claimed",
      password_hash: passwordHashVal,
    };
    mockRepos.guestAccess.findByInviteCode.mockResolvedValue(mockGuest);
    mockRepos.guestAccess.updateSessionToken.mockImplementation((input: any) => ({
      ...mockGuest,
      session_token_hash: input.sessionTokenHash,
    }));

    const result = await loginGuest(mockRepos, {
      inviteCode: "code-123",
      password: "mypassword",
    });

    expect(result.secret).toBeDefined();
    expect(result.secret.length).toBeGreaterThan(16);
    expect(mockRepos.guestAccess.updateSessionToken).toHaveBeenCalledOnce();
  });

  it("loginGuest should reject incorrect passwords", async () => {
    const passwordHashVal = await hashPassword("mypassword");
    const mockGuest = {
      id: "guest-id-123",
      tenant_id: "tenant-123",
      invite_code: "code-123",
      status: "claimed",
      password_hash: passwordHashVal,
    };
    mockRepos.guestAccess.findByInviteCode.mockResolvedValue(mockGuest);

    await expect(
      loginGuest(mockRepos, {
        inviteCode: "code-123",
        password: "wrongpassword",
      })
    ).rejects.toThrow("Invalid password");
  });

  it("verifyGuestSession should return guest row if secret matches session hash", async () => {
    const sessionTokenHash = crypto.createHash("sha256").update("mytoken").digest("hex");
    const mockGuest = {
      id: "guest-id-123",
      tenant_id: "tenant-123",
      invite_code: "code-123",
      status: "claimed",
      session_token_hash: sessionTokenHash,
    };
    mockRepos.guestAccess.findByInviteCode.mockResolvedValue(mockGuest);

    const result = await verifyGuestSession(mockRepos, "code-123", "mytoken");

    expect(result).toEqual(mockGuest);
    expect(mockRepos.guestAccess.updateLastSeen).toHaveBeenCalledWith("code-123");
  });

  it("verifyGuestSession should reject invalid token", async () => {
    const sessionTokenHash = crypto.createHash("sha256").update("mytoken").digest("hex");
    const mockGuest = {
      id: "guest-id-123",
      tenant_id: "tenant-123",
      invite_code: "code-123",
      status: "claimed",
      session_token_hash: sessionTokenHash,
    };
    mockRepos.guestAccess.findByInviteCode.mockResolvedValue(mockGuest);

    await expect(
      verifyGuestSession(mockRepos, "code-123", "wrongtoken")
    ).rejects.toThrow("Invalid session token");
  });
});
