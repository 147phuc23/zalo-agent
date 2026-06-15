import type pg from "pg";

export type DatabaseClient = pg.Pool;

export interface TenantRow {
  id: string;
  name: string;
  timezone: string;
  locale: string;
  status: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
}

export interface TenantUserRow {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface ChannelAccountRow {
  id: string;
  tenant_id: string;
  channel: string;
  external_account_id: string | null;
  status: string;
  encrypted_session_blob: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface ContactRow {
  id: string;
  tenant_id: string;
  channel: string;
  external_user_id: string;
  display_name: string | null;
  phone: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  tenant_id: string;
  channel: string;
  external_thread_id: string;
  contact_id: string;
  status: string;
  assignee_user_id: string | null;
  override_model: string | null;
  last_activity_at: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  tenant_id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  text: string | null;
  external_message_id: string | null;
  idempotency_key: string;
  raw_payload: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface MessageDeliveryRow {
  id: string;
  tenant_id: string;
  message_id: string;
  attempt: number;
  status: string;
  error_code: string | null;
  error_message: string | null;
  provider_payload: Record<string, unknown>;
  created_at: string;
}

export interface WorkflowConfigRow {
  id: string;
  tenant_id: string;
  mode: "auto" | "approval" | "manual" | "blocked";
  default_model: string | null;
  classifier_model: string | null;
  embedding_model: string | null;
  max_tool_turns: number;
  temperature: number;
  prompt_settings: Record<string, unknown>;
  crm_mapping: Record<string, unknown>;
  blocked_topics: unknown[];
  created_at: string;
}

export interface ToolCallAuditRow {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  run_id: string | null;
  tool_name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: "ok" | "error";
  created_at: string;
}

export interface HumanTaskRow {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  type: "approval" | "handoff";
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface PromptTemplateRow {
  id: string;
  tenant_id: string;
  key: string;
  content: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

export function createTenantRepository(client: DatabaseClient) {
  return {
    async ensureExists(input: { tenantId: string; name: string; timezone: string; locale: string }) {
      const existing = await client.query("SELECT id FROM tenants WHERE id = $1 LIMIT 1", [input.tenantId]);
      if (!existing.rows[0]) {
        await client.query(
          "INSERT INTO tenants (id, name, timezone, locale, status) VALUES ($1, $2, $3, $4, 'active')",
          [input.tenantId, input.name, input.timezone, input.locale]
        );
      }
    },
  };
}

export function createContactRepository(client: DatabaseClient) {
  return {
    async findByExternalUser(input: { tenantId: string; channel: string; externalUserId: string }) {
      const res = await client.query(
        `SELECT id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at 
         FROM contacts 
         WHERE tenant_id = $1 AND channel = $2 AND external_user_id = $3 
         LIMIT 1`,
        [input.tenantId, input.channel, input.externalUserId]
      );
      return (res.rows[0] as ContactRow) || null;
    },
    async listByIds(input: { ids: string[] }) {
      if (input.ids.length === 0) return [];
      const res = await client.query(
        `SELECT id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at 
         FROM contacts 
         WHERE id = ANY($1)`,
        [input.ids]
      );
      return res.rows as ContactRow[];
    },
    async createShadow(input: {
      tenantId: string;
      channel: string;
      externalUserId: string;
      displayName?: string | null;
      phone?: string | null;
      metadata?: Record<string, unknown>;
    }) {
      const res = await client.query(
        `INSERT INTO contacts (tenant_id, channel, external_user_id, display_name, phone, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at`,
        [
          input.tenantId,
          input.channel,
          input.externalUserId,
          input.displayName ?? null,
          input.phone ?? null,
          JSON.stringify(input.metadata ?? {}),
        ]
      );
      return res.rows[0] as ContactRow;
    },
  };
}

export function createConversationRepository(client: DatabaseClient) {
  return {
    async findByExternalThread(input: { tenantId: string; channel: string; externalThreadId: string }) {
      const res = await client.query(
        `SELECT id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at, created_at 
         FROM conversations 
         WHERE tenant_id = $1 AND channel = $2 AND external_thread_id = $3 
         LIMIT 1`,
        [input.tenantId, input.channel, input.externalThreadId]
      );
      return (res.rows[0] as ConversationRow) || null;
    },
    async findById(conversationId: string) {
      const res = await client.query(
        `SELECT id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at, created_at 
         FROM conversations 
         WHERE id = $1 
         LIMIT 1`,
        [conversationId]
      );
      return (res.rows[0] as ConversationRow) || null;
    },
    async listByTenant(input: { tenantId: string; limit: number }) {
      const res = await client.query(
        `SELECT id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at, created_at 
         FROM conversations 
         WHERE tenant_id = $1 
         ORDER BY last_activity_at DESC 
         LIMIT $2`,
        [input.tenantId, input.limit]
      );
      return res.rows as ConversationRow[];
    },
    async create(input: {
      tenantId: string;
      channel: string;
      externalThreadId: string;
      contactId: string;
      status?: string;
      assigneeUserId?: string | null;
      overrideModel?: string | null;
      lastActivityAt?: string;
    }) {
      const res = await client.query(
        `INSERT INTO conversations (tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at, created_at`,
        [
          input.tenantId,
          input.channel,
          input.externalThreadId,
          input.contactId,
          input.status ?? "open",
          input.assigneeUserId ?? null,
          input.overrideModel ?? null,
          input.lastActivityAt ?? new Date().toISOString(),
        ]
      );
      return res.rows[0] as ConversationRow;
    },
    async updateLastActivity(conversationId: string, lastActivityAt: string) {
      await client.query(
        "UPDATE conversations SET last_activity_at = $1 WHERE id = $2",
        [lastActivityAt, conversationId]
      );
    },
    async updateAssignee(conversationId: string, assigneeUserId: string | null) {
      await client.query(
        "UPDATE conversations SET assignee_user_id = $1 WHERE id = $2",
        [assigneeUserId, conversationId]
      );
    },
    async updateStatus(conversationId: string, status: string) {
      await client.query(
        "UPDATE conversations SET status = $1 WHERE id = $2",
        [status, conversationId]
      );
    },
    async updateOverrideModel(conversationId: string, overrideModel: string | null) {
      await client.query(
        "UPDATE conversations SET override_model = $1 WHERE id = $2",
        [overrideModel, conversationId]
      );
    },
  };
}

export function createMessageRepository(client: DatabaseClient) {
  return {
    async listByConversation(input: { conversationId: string; limit: number }) {
      const res = await client.query(
        `SELECT id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read, read_at, created_at 
         FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [input.conversationId, input.limit]
      );
      return (res.rows as MessageRow[]).reverse();
    },
    async findLatestByExternalMessageId(input: { tenantId: string; externalMessageId: string }) {
      const res = await client.query(
        `SELECT id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read, read_at, created_at 
         FROM messages 
         WHERE tenant_id = $1 AND external_message_id = $2 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [input.tenantId, input.externalMessageId]
      );
      return (res.rows[0] as MessageRow) || null;
    },
    async createInbound(input: {
      tenantId: string;
      conversationId: string;
      messageType: string;
      text?: string | null;
      externalMessageId?: string | null;
      idempotencyKey: string;
      rawPayload: Record<string, unknown>;
    }): Promise<MessageRow> {
      const res = await client.query(
        `INSERT INTO messages (tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read)
         VALUES ($1, $2, 'inbound', $3, $4, $5, $6, $7, false)
         RETURNING id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, is_read, read_at, created_at`,
        [
          input.tenantId,
          input.conversationId,
          input.messageType,
          input.text ?? null,
          input.externalMessageId ?? null,
          input.idempotencyKey,
          JSON.stringify(input.rawPayload),
        ]
      );
      return res.rows[0] as MessageRow;
    },
    async createOutbound(input: {
      tenantId: string;
      conversationId: string;
      messageType: string;
      text: string;
      externalMessageId?: string | null;
      idempotencyKey: string;
      rawPayload: Record<string, unknown>;
    }): Promise<MessageRow> {
      const res = await client.query(
        `INSERT INTO messages (tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read, read_at)
         VALUES ($1, $2, 'outbound', $3, $4, $5, $6, $7, true, NOW())
         RETURNING id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, is_read, read_at, created_at`,
        [
          input.tenantId,
          input.conversationId,
          input.messageType,
          input.text,
          input.externalMessageId ?? null,
          input.idempotencyKey,
          JSON.stringify(input.rawPayload),
        ]
      );
      return res.rows[0] as MessageRow;
    },
    async markAsRead(conversationId: string) {
      await client.query(
        "UPDATE messages SET is_read = true, read_at = NOW() WHERE conversation_id = $1 AND direction = 'inbound' AND is_read = false",
        [conversationId]
      );
    },
    async findById(id: string): Promise<MessageRow | null> {
      const res = await client.query(
        `SELECT id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read, read_at, created_at 
         FROM messages 
         WHERE id = $1 
         LIMIT 1`,
        [id]
      );
      return (res.rows[0] as MessageRow) || null;
    },
    async updateRawPayload(id: string, rawPayload: Record<string, unknown>): Promise<void> {
      await client.query(
        `UPDATE messages 
         SET raw_payload = $1 
         WHERE id = $2`,
        [JSON.stringify(rawPayload), id]
      );
    },
  };
}

export function createDeliveryRepository(client: DatabaseClient) {
  return {
    async create(input: {
      tenantId: string;
      messageId: string;
      status: string;
      attempt?: number;
      errorCode?: string | null;
      errorMessage?: string | null;
      providerPayload?: Record<string, unknown>;
    }) {
      await client.query(
        `INSERT INTO message_deliveries (tenant_id, message_id, attempt, status, error_code, error_message, provider_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.tenantId,
          input.messageId,
          input.attempt ?? 1,
          input.status,
          input.errorCode ?? null,
          input.errorMessage ?? null,
          JSON.stringify(input.providerPayload ?? {}),
        ]
      );
    },
  };
}

export function createWorkflowConfigRepository(client: DatabaseClient) {
  return {
    async findLatestByTenant(tenantId: string) {
      const res = await client.query(
        `SELECT id, tenant_id, mode, default_model, classifier_model, embedding_model, max_tool_turns, temperature, prompt_settings, crm_mapping, blocked_topics, created_at 
         FROM workflow_configs 
         WHERE tenant_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [tenantId]
      );
      return (res.rows[0] as WorkflowConfigRow) || null;
    },
  };
}

export function createHumanTaskRepository(client: DatabaseClient) {
  return {
    async create(input: {
      tenantId: string;
      conversationId?: string | null;
      type: "approval" | "handoff";
      status?: string;
      payload?: Record<string, unknown>;
    }) {
      await client.query(
        `INSERT INTO human_tasks (tenant_id, conversation_id, type, status, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          input.tenantId,
          input.conversationId ?? null,
          input.type,
          input.status ?? "open",
          JSON.stringify(input.payload ?? {}),
        ]
      );
    },
  };
}

export function createAuditRepository(client: DatabaseClient) {
  return {
    async append(input: {
      tenantId: string;
      conversationId?: string | null;
      runId?: string | null;
      toolName: string;
      inputPayload?: Record<string, unknown>;
      outputPayload?: Record<string, unknown> | null;
      status?: "ok" | "error";
    }): Promise<ToolCallAuditRow> {
      const res = await client.query(
        `INSERT INTO tool_call_audits (tenant_id, conversation_id, run_id, tool_name, input, output, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, tenant_id, conversation_id, run_id, tool_name, input, output, status, created_at`,
        [
          input.tenantId,
          input.conversationId ?? null,
          input.runId ?? null,
          input.toolName,
          JSON.stringify(input.inputPayload ?? {}),
          input.outputPayload === null ? null : JSON.stringify(input.outputPayload ?? {}),
          input.status ?? "ok",
        ]
      );
      return res.rows[0] as ToolCallAuditRow;
    },
    async listByConversation(conversationId: string) {
      const res = await client.query(
        `SELECT id, tenant_id, conversation_id, run_id, tool_name, input, output, status, created_at 
         FROM tool_call_audits 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC`,
        [conversationId]
      );
      return res.rows as ToolCallAuditRow[];
    },
  };
}

export function createPromptTemplateRepository(client: DatabaseClient) {
  return {
    async findActive(input: { tenantId: string; key: string }) {
      const res = await client.query(
        `SELECT id, tenant_id, key, content, version, is_active, created_at 
         FROM prompt_templates 
         WHERE tenant_id = $1 AND key = $2 AND is_active = true 
         LIMIT 1`,
        [input.tenantId, input.key]
      );
      return (res.rows[0] as PromptTemplateRow) || null;
    },
    async create(input: { tenantId: string; key: string; content: string; version: number }) {
      await client.query(
        "UPDATE prompt_templates SET is_active = false WHERE tenant_id = $1 AND key = $2",
        [input.tenantId, input.key]
      );
      const res = await client.query(
        `INSERT INTO prompt_templates (tenant_id, key, content, version, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, tenant_id, key, content, version, is_active, created_at`,
        [input.tenantId, input.key, input.content, input.version]
      );
      return res.rows[0] as PromptTemplateRow;
    },
    async listVersions(input: { tenantId: string; key: string }) {
      const res = await client.query(
        `SELECT id, tenant_id, key, content, version, is_active, created_at 
         FROM prompt_templates 
         WHERE tenant_id = $1 AND key = $2 
         ORDER BY version DESC`,
        [input.tenantId, input.key]
      );
      return res.rows as PromptTemplateRow[];
    },
  };
}

export function createRepositorySet(client: DatabaseClient) {
  return {
    tenants: createTenantRepository(client),
    contacts: createContactRepository(client),
    conversations: createConversationRepository(client),
    messages: createMessageRepository(client),
    deliveries: createDeliveryRepository(client),
    workflows: createWorkflowConfigRepository(client),
    tasks: createHumanTaskRepository(client),
    audits: createAuditRepository(client),
    prompts: createPromptTemplateRepository(client),
  };
}
