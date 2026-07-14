import crypto from "node:crypto";
import type { createRepositorySet, GuestAccessRow } from "@platform/database";
import { ingestInboundMessage } from "./ingest.js";
import { generateAndSaveReply } from "./reply.js";

type Repos = ReturnType<typeof createRepositorySet>;

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      const derivedBuf = derivedKey;
      const keyBuf = Buffer.from(key, "hex");
      if (derivedBuf.length !== keyBuf.length) {
        return resolve(false);
      }
      resolve(crypto.timingSafeEqual(derivedBuf, keyBuf));
    });
  });
}

export async function createInvite(repos: Repos, input: { tenantId: string }): Promise<GuestAccessRow> {
  const inviteCode = crypto.randomBytes(18).toString("base64url");
  return repos.guestAccess.create({
    tenantId: input.tenantId,
    inviteCode,
  });
}

export async function claimInvite(
  repos: Repos,
  input: {
    inviteCode: string;
    password: string;
    displayName: string;
    profile: Record<string, unknown>;
  }
): Promise<{ guest: GuestAccessRow; secret: string }> {
  const guestRow = await repos.guestAccess.findByInviteCode(input.inviteCode);
  if (!guestRow) {
    throw new Error("Invite code not found");
  }
  if (guestRow.status !== "pending") {
    throw new Error("Invite code is already claimed or revoked");
  }

  const passwordHash = await hashPassword(input.password);

  const externalUserId = `guest-${guestRow.id}`;
  const externalThreadId = `guest-${guestRow.id}`;

  // Ensure tenant exists
  await repos.tenants.ensureExists({
    tenantId: guestRow.tenant_id,
    name: `tenant-${guestRow.tenant_id.slice(0, 8)}`,
    timezone: "Asia/Ho_Chi_Minh",
    locale: "vi-VN",
  });

  // Create contact
  const contact = await repos.contacts.createShadow({
    tenantId: guestRow.tenant_id,
    channel: "zalo",
    externalUserId,
    displayName: input.displayName,
  });

  // Create conversation
  const conversation = await repos.conversations.create({
    tenantId: guestRow.tenant_id,
    channel: "zalo",
    externalThreadId,
    contactId: contact.id,
  });

  // Generate session secret
  const secret = crypto.randomBytes(32).toString("base64url");
  const sessionTokenHash = crypto.createHash("sha256").update(secret).digest("hex");

  // Perform claim atomically
  const updatedGuest = await repos.guestAccess.updateClaim({
    inviteCode: input.inviteCode,
    passwordHash,
    displayName: input.displayName,
    profile: input.profile,
    contactId: contact.id,
    conversationId: conversation.id,
    sessionTokenHash,
  });

  if (!updatedGuest) {
    throw new Error("Claim failed, invite code might have been claimed concurrently");
  }

  // Ingest first synthetic message built from the profile
  const desiredRole = input.profile.desiredRole ?? "";
  const experience = input.profile.experienceYears ?? "";
  const expectedSalary = input.profile.expectedSalary ?? "";

  let introText = `Xin chào! Tôi là ${input.displayName}.`;
  const details: string[] = [];
  if (desiredRole) details.push(`vị trí ứng tuyển: ${desiredRole}`);
  if (experience) details.push(`kinh nghiệm: ${experience} năm`);
  if (expectedSalary) details.push(`mức lương mong muốn: ${expectedSalary}`);
  if (details.length > 0) {
    introText += ` Tôi quan tâm đến ${details.join(", ")}.`;
  }

  const ingest = await ingestInboundMessage(repos, {
    tenantId: guestRow.tenant_id,
    channel: "zalo",
    threadId: externalThreadId,
    senderExternalId: externalUserId,
    messageType: "text",
    text: introText,
    idempotencyKey: `guest-intro-${guestRow.id}`,
    receivedAt: new Date().toISOString(),
    displayName: input.displayName,
  });

  // Generate first reply
  if (ingest.status !== "duplicate") {
    try {
      await generateAndSaveReply(repos, {
        tenantId: guestRow.tenant_id,
        conversationId: conversation.id,
        targetMessageId: ingest.messageId,
      });
    } catch (replyErr) {
      console.error("[core:guest] failed to generate initial reply:", replyErr);
    }
  }

  return { guest: updatedGuest, secret };
}

export async function loginGuest(
  repos: Repos,
  input: { inviteCode: string; password: string }
): Promise<{ guest: GuestAccessRow; secret: string }> {
  const guestRow = await repos.guestAccess.findByInviteCode(input.inviteCode);
  if (!guestRow) {
    throw new Error("Invite code not found");
  }
  if (guestRow.status !== "claimed") {
    throw new Error("Invite code is not claimed");
  }
  if (!guestRow.password_hash) {
    throw new Error("Invalid guest credentials");
  }

  const isValid = await verifyPassword(input.password, guestRow.password_hash);
  if (!isValid) {
    throw new Error("Invalid password");
  }

  const secret = crypto.randomBytes(32).toString("base64url");
  const sessionTokenHash = crypto.createHash("sha256").update(secret).digest("hex");

  const updatedGuest = await repos.guestAccess.updateSessionToken({
    inviteCode: input.inviteCode,
    sessionTokenHash,
  });

  if (!updatedGuest) {
    throw new Error("Failed to update guest session");
  }

  return { guest: updatedGuest, secret };
}

export async function verifyGuestSession(
  repos: Repos,
  inviteCode: string,
  bearerToken: string
): Promise<GuestAccessRow> {
  const guestRow = await repos.guestAccess.findByInviteCode(inviteCode);
  if (!guestRow) {
    throw new Error("Invite code not found");
  }
  if (guestRow.status !== "claimed") {
    throw new Error("Invite is not claimed");
  }
  if (!guestRow.session_token_hash) {
    throw new Error("Session invalid");
  }

  const tokenHash = crypto.createHash("sha256").update(bearerToken).digest("hex");
  const bufferA = Buffer.from(tokenHash, "hex");
  const bufferB = Buffer.from(guestRow.session_token_hash, "hex");

  const isMatch =
    bufferA.length === bufferB.length &&
    crypto.timingSafeEqual(bufferA, bufferB);

  if (!isMatch) {
    throw new Error("Invalid session token");
  }

  await repos.guestAccess.updateLastSeen(inviteCode);
  return guestRow;
}

export async function listGuestMessages(
  repos: Repos,
  guest: GuestAccessRow,
  input: { limit: number; after?: string | Date }
) {
  if (!guest.conversation_id) {
    throw new Error("Guest does not have a conversation active");
  }
  const messages = await repos.messages.listByConversation({
    conversationId: guest.conversation_id,
    limit: input.limit,
    after: input.after,
  });

  return messages.map((m) => ({
    id: m.id,
    tenantId: m.tenant_id,
    conversationId: m.conversation_id,
    direction: m.direction,
    messageType: m.message_type,
    text: m.text,
    externalMessageId: m.external_message_id,
    idempotencyKey: m.idempotency_key,
    rawPayload: m.raw_payload,
    isRead: m.is_read,
    readAt: m.read_at,
    createdAt: m.created_at,
  }));
}

export async function sendGuestMessage(
  repos: Repos,
  guest: GuestAccessRow,
  input: { text: string }
) {
  if (!guest.conversation_id) {
    throw new Error("Guest does not have a conversation active");
  }
  const externalUserId = `guest-${guest.id}`;
  const externalThreadId = `guest-${guest.id}`;
  const idempotencyKey = `guest-msg-${guest.id}-${Date.now()}`;

  const ingest = await ingestInboundMessage(repos, {
    tenantId: guest.tenant_id,
    channel: "zalo",
    threadId: externalThreadId,
    senderExternalId: externalUserId,
    messageType: "text",
    text: input.text,
    idempotencyKey,
    receivedAt: new Date().toISOString(),
    displayName: guest.display_name,
  });

  if (ingest.status !== "duplicate") {
    try {
      await generateAndSaveReply(repos, {
        tenantId: guest.tenant_id,
        conversationId: guest.conversation_id,
        targetMessageId: ingest.messageId,
      });
    } catch (err) {
      console.error("[core:guest] reply generation failed:", err);
    }
  }

  return { conversationId: guest.conversation_id };
}
