import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import dotenv from "dotenv";
import { ThreadType, Zalo } from "zca-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(REPO_ROOT, ".env.local") });

const DATA_DIR = path.resolve(__dirname, "../data");
const CREDENTIALS_FILE = path.join(DATA_DIR, "credentials.json");
const INBOUND_LOG_FILE = path.join(DATA_DIR, "inbound.ndjson");
const LEGACY_CREDENTIALS_FILE = path.resolve(__dirname, "../../../credentials.json");

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3010";
const INTERNAL_INGEST_TOKEN = process.env.INTERNAL_INGEST_TOKEN ?? "";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const TENANT_ID =
  process.env.TENANT_ID ?? "11111111-1111-1111-1111-111111111111"; // sales-demo

ensureDataDir();

const zalo = new Zalo();
const api = await login();

await postToApi(createConnectorHealthEvent("ok", api.getOwnId?.()));

api.listener.on("message", async (message) => {
  const normalizedEvent = normalizeInboundMessage(message);

  if (!normalizedEvent) {
    return;
  }

  appendInboundEvent(normalizedEvent);
  await postToApi(normalizedEvent);

  console.log(
    `[zalo-connector] inbound ${normalizedEvent.threadId}: ${normalizedEvent.text}`,
  );
});

api.listener.start();
console.log("[zalo-connector] listener started");

const sendWorker = new Worker(
  "message.send",
  async (job) => {
    const outbound = normalizeOutboundMessage(job.data);

    if (outbound.tenantId !== TENANT_ID) {
      console.log(
        `[zalo-connector] skipped outbound for tenant ${outbound.tenantId}`,
      );
      return { skipped: true, reason: "tenant-mismatch" };
    }

    await api.sendMessage(outbound.text, outbound.threadId, ThreadType.User);
    console.log(`[zalo-connector] outbound ${outbound.threadId}: ${outbound.text}`);
    return { ok: true };
  },
  { connection: { url: REDIS_URL } },
);

sendWorker.on("failed", (job, err) => {
  console.warn("[zalo-connector] outbound failed", job?.id, err?.message ?? err);
});

console.log("[zalo-connector] outbound sender started");

async function login() {
  migrateLegacyCredentials();

  if (fs.existsSync(CREDENTIALS_FILE)) {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    const connectedApi = await zalo.login(credentials);
    console.log("[zalo-connector] logged in with saved credentials");
    return connectedApi;
  }

  const connectedApi = await zalo.loginQR();
  const context = connectedApi.getContext();
  const credentials = {
    imei: context.imei,
    userAgent: context.userAgent,
    cookie: context.cookie.toJSON(),
  };

  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
  console.log(`[zalo-connector] saved credentials to ${CREDENTIALS_FILE}`);

  return connectedApi;
}

function normalizeInboundMessage(message) {
  if (message.isSelf) {
    return null;
  }

  const text = readTextContent(message);

  if (!text) {
    return null;
  }

  if (message.type !== ThreadType.User && message.type !== ThreadType.Group) {
    return null;
  }

  const threadId = String(message.threadId);
  const senderExternalId = String(message.data.uidFrom ?? message.data.fromId ?? "unknown");
  const receivedAt = new Date().toISOString();

  return {
    kind: "message.received",
    tenantId: TENANT_ID,
    channel: "zalo",
    threadId,
    externalMessageId: String(message.data?.msgId ?? ""),
    senderExternalId,
    messageType: "text",
    text,
    receivedAt,
    idempotencyKey: buildIdempotencyKey({ threadId, senderExternalId, text }),
    rawPayload: {
      type: message.type,
      data: message.data,
    },
  };
}

function readTextContent(message) {
  if (typeof message?.data?.content === "string") {
    return message.data.content.trim();
  }

  return "";
}

function normalizeOutboundMessage(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid outbound message: expected object");
  }

  const tenantId = readRequiredString(value, "tenantId");
  const channel = readRequiredString(value, "channel");
  const threadId = readRequiredString(value, "threadId");
  const text = readRequiredString(value, "text");

  if (channel !== "zalo") {
    throw new Error(`Unsupported outbound channel: ${channel}`);
  }

  return { tenantId, channel, threadId, text };
}

function readRequiredString(value, key) {
  const field = value[key];
  if (typeof field !== "string" || !field.trim()) {
    throw new Error(`Invalid outbound message: missing ${key}`);
  }
  return field.trim();
}

function appendInboundEvent(event) {
  fs.appendFileSync(INBOUND_LOG_FILE, `${JSON.stringify(event)}\n`);
}

function createConnectorHealthEvent(status, externalAccountId) {
  return {
    kind: "connector.health",
    tenantId: TENANT_ID,
    channel: "zalo",
    status,
    externalAccountId: externalAccountId ? String(externalAccountId) : undefined,
    receivedAt: new Date().toISOString(),
    rawPayload: {
      source: "zalo-connector",
      credentialsFile: CREDENTIALS_FILE,
    },
  };
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function migrateLegacyCredentials() {
  if (fs.existsSync(CREDENTIALS_FILE) || !fs.existsSync(LEGACY_CREDENTIALS_FILE)) {
    return;
  }

  fs.copyFileSync(LEGACY_CREDENTIALS_FILE, CREDENTIALS_FILE);
  console.log("[zalo-connector] migrated legacy credentials into service data");
}

function buildIdempotencyKey({ threadId, senderExternalId, text }) {
  const base = `zalo:${TENANT_ID}:${threadId}:${senderExternalId}:${text}`;
  return crypto.createHash("sha256").update(base).digest("hex");
}

async function postToApi(event) {
  if (!INTERNAL_INGEST_TOKEN) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/internal/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${INTERNAL_INGEST_TOKEN}`,
      },
      body: JSON.stringify({ events: [event] }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("[zalo-connector] api ingest failed", res.status, text);
    }
  } catch (err) {
    console.warn("[zalo-connector] api ingest error", err?.message ?? err);
  }
}
