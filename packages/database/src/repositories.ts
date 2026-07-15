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
    async ensureExists(input: {
      tenantId: string;
      name: string;
      timezone: string;
      locale: string;
    }) {
      const existing = await client.query(
        "SELECT id FROM tenants WHERE id = $1 LIMIT 1",
        [input.tenantId],
      );
      if (!existing.rows[0]) {
        await client.query(
          "INSERT INTO tenants (id, name, timezone, locale, status) VALUES ($1, $2, $3, $4, 'active')",
          [input.tenantId, input.name, input.timezone, input.locale],
        );
      }
    },
  };
}

export function createContactRepository(client: DatabaseClient) {
  return {
    async findById(id: string) {
      const res = await client.query(
        `SELECT id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at 
         FROM contacts 
         WHERE id = $1 
         LIMIT 1`,
        [id],
      );
      return (res.rows[0] as ContactRow) || null;
    },
    async findByExternalUser(input: {
      tenantId: string;
      channel: string;
      externalUserId: string;
    }) {
      const res = await client.query(
        `SELECT id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at 
         FROM contacts 
         WHERE tenant_id = $1 AND channel = $2 AND external_user_id = $3 
         LIMIT 1`,
        [input.tenantId, input.channel, input.externalUserId],
      );
      return (res.rows[0] as ContactRow) || null;
    },
    async listByIds(input: { ids: string[] }) {
      if (input.ids.length === 0) return [];
      const res = await client.query(
        `SELECT id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at 
         FROM contacts 
         WHERE id = ANY($1)`,
        [input.ids],
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
        ],
      );
      return res.rows[0] as ContactRow;
    },
  };
}

export function createConversationRepository(client: DatabaseClient) {
  return {
    async findByExternalThread(input: {
      tenantId: string;
      channel: string;
      externalThreadId: string;
    }) {
      const res = await client.query(
        `SELECT id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at, created_at 
         FROM conversations 
         WHERE tenant_id = $1 AND channel = $2 AND external_thread_id = $3 
         LIMIT 1`,
        [input.tenantId, input.channel, input.externalThreadId],
      );
      return (res.rows[0] as ConversationRow) || null;
    },
    async findById(conversationId: string) {
      const res = await client.query(
        `SELECT id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at, created_at 
         FROM conversations 
         WHERE id = $1 
         LIMIT 1`,
        [conversationId],
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
        [input.tenantId, input.limit],
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
        ],
      );
      return res.rows[0] as ConversationRow;
    },
    async updateLastActivity(conversationId: string, lastActivityAt: string) {
      await client.query("UPDATE conversations SET last_activity_at = $1 WHERE id = $2", [
        lastActivityAt,
        conversationId,
      ]);
    },
    async updateAssignee(conversationId: string, assigneeUserId: string | null) {
      await client.query("UPDATE conversations SET assignee_user_id = $1 WHERE id = $2", [
        assigneeUserId,
        conversationId,
      ]);
    },
    async updateStatus(conversationId: string, status: string) {
      await client.query("UPDATE conversations SET status = $1 WHERE id = $2", [
        status,
        conversationId,
      ]);
    },
    async updateOverrideModel(conversationId: string, overrideModel: string | null) {
      await client.query("UPDATE conversations SET override_model = $1 WHERE id = $2", [
        overrideModel,
        conversationId,
      ]);
    },
  };
}

export function createMessageRepository(client: DatabaseClient) {
  return {
    async listByConversation(input: {
      conversationId: string;
      limit: number;
      after?: string | Date;
    }) {
      let query = `SELECT id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read, read_at, created_at 
         FROM messages 
         WHERE conversation_id = $1`;
      const params: any[] = [input.conversationId];
      if (input.after) {
        query += ` AND created_at > $2 ORDER BY created_at DESC LIMIT $3`;
        params.push(input.after, input.limit);
      } else {
        query += ` ORDER BY created_at DESC LIMIT $2`;
        params.push(input.limit);
      }
      const res = await client.query(query, params);
      return (res.rows as MessageRow[]).reverse();
    },
    async findLatestByExternalMessageId(input: {
      tenantId: string;
      externalMessageId: string;
    }) {
      const res = await client.query(
        `SELECT id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read, read_at, created_at 
         FROM messages 
         WHERE tenant_id = $1 AND external_message_id = $2 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [input.tenantId, input.externalMessageId],
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
        ],
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
        ],
      );
      return res.rows[0] as MessageRow;
    },
    async markAsRead(conversationId: string) {
      await client.query(
        "UPDATE messages SET is_read = true, read_at = NOW() WHERE conversation_id = $1 AND direction = 'inbound' AND is_read = false",
        [conversationId],
      );
    },
    async findById(id: string): Promise<MessageRow | null> {
      const res = await client.query(
        `SELECT id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read, read_at, created_at 
         FROM messages 
         WHERE id = $1 
         LIMIT 1`,
        [id],
      );
      return (res.rows[0] as MessageRow) || null;
    },
    async updateRawPayload(
      id: string,
      rawPayload: Record<string, unknown>,
    ): Promise<void> {
      await client.query(
        `UPDATE messages 
         SET raw_payload = $1 
         WHERE id = $2`,
        [JSON.stringify(rawPayload), id],
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
        ],
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
        [tenantId],
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
        ],
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
        ],
      );
      return res.rows[0] as ToolCallAuditRow;
    },
    async listByConversation(conversationId: string, after?: string | Date) {
      let query = `SELECT id, tenant_id, conversation_id, run_id, tool_name, input, output, status, created_at 
         FROM tool_call_audits 
         WHERE conversation_id = $1`;
      const params: any[] = [conversationId];
      if (after) {
        query += ` AND created_at > $2`;
        params.push(after);
      }
      query += ` ORDER BY created_at ASC`;
      const res = await client.query(query, params);
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
        [input.tenantId, input.key],
      );
      return (res.rows[0] as PromptTemplateRow) || null;
    },
    async create(input: {
      tenantId: string;
      key: string;
      content: string;
      version: number;
    }) {
      await client.query(
        "UPDATE prompt_templates SET is_active = false WHERE tenant_id = $1 AND key = $2",
        [input.tenantId, input.key],
      );
      const res = await client.query(
        `INSERT INTO prompt_templates (tenant_id, key, content, version, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, tenant_id, key, content, version, is_active, created_at`,
        [input.tenantId, input.key, input.content, input.version],
      );
      return res.rows[0] as PromptTemplateRow;
    },
    async listVersions(input: { tenantId: string; key: string }) {
      const res = await client.query(
        `SELECT id, tenant_id, key, content, version, is_active, created_at 
         FROM prompt_templates 
         WHERE tenant_id = $1 AND key = $2 
         ORDER BY version DESC`,
        [input.tenantId, input.key],
      );
      return res.rows as PromptTemplateRow[];
    },
  };
}

export interface CompanyRow {
  id: string;
  tenant_id: string;
  name: string;
  introduction: string;
  benefits: string;
  work_style: string;
  created_at: string;
  updated_at: string;
}

export function createCompanyRepository(client: DatabaseClient) {
  return {
    async findByName(input: { tenantId: string; name: string }) {
      const res = await client.query(
        `SELECT * FROM companies WHERE tenant_id = $1 AND name = $2`,
        [input.tenantId, input.name]
      );
      return (res.rows[0] as CompanyRow) || null;
    },
    async ensureExists(input: {
      tenantId: string;
      name: string;
      introduction?: string;
      benefits?: string;
      workStyle?: string;
    }) {
      const res = await client.query(
        `INSERT INTO companies (tenant_id, name, introduction, benefits, work_style)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [
          input.tenantId,
          input.name,
          input.introduction ?? `Introduction to ${input.name}`,
          input.benefits ?? `Benefits at ${input.name}`,
          input.workStyle ?? `Work style at ${input.name}`
        ]
      );
      return res.rows[0]?.id as string;
    }
  };
}

export interface JobPostingRow {
  id: string;
  tenant_id: string;
  external_id: string | null;
  title: string;
  company_id: string;
  company: string; // from JOIN
  company_introduction?: string; // from JOIN
  company_benefits?: string; // from JOIN
  company_work_style?: string; // from JOIN
  location_slugs: string[];
  work_mode: "remote" | "hybrid" | "onsite";
  salary_min_vnd: number;
  salary_max_vnd: number;
  seniority: string;
  required_skills: string[];
  description: string;
  job_type: string | null;
  experience_required_years: number | null;
  benefits: string | null;
  education_required: string | null;
  is_active: boolean;
  created_at: string;
}

export function createJobPostingRepository(client: DatabaseClient) {
  return {
    async listActive(input: { tenantId: string; limit?: number }) {
      const res = await client.query(
        `SELECT jp.*, c.name AS company, c.introduction AS company_introduction, c.benefits AS company_benefits, c.work_style AS company_work_style
         FROM job_postings jp
         LEFT JOIN companies c ON jp.company_id = c.id
         WHERE jp.tenant_id = $1 AND jp.is_active = true
         ORDER BY jp.created_at DESC
         LIMIT $2`,
        [input.tenantId, input.limit ?? 500],
      );
      return res.rows as JobPostingRow[];
    },
    async count(input: { tenantId: string }) {
      const res = await client.query(
        "SELECT COUNT(*)::int AS n FROM job_postings WHERE tenant_id = $1 AND is_active = true",
        [input.tenantId],
      );
      return (res.rows[0]?.n as number) ?? 0;
    },
    async bulkInsert(input: {
      tenantId: string;
      jobs: Array<{
        externalId?: string | null;
        title: string;
        company: string;
        locationSlugs: string[];
        workMode: "remote" | "hybrid" | "onsite";
        salaryMinVnd: number;
        salaryMaxVnd: number;
        seniority: string;
        requiredSkills: string[];
        description: string;
        jobType?: string | null;
        experienceRequiredYears?: number | null;
        benefits?: string | null;
        educationRequired?: string | null;
      }>;
    }) {
      let inserted = 0;
      for (const j of input.jobs) {
        // Ensure company exists
        const companyRes = await client.query(
          `INSERT INTO companies (tenant_id, name, introduction, benefits, work_style)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [
            input.tenantId,
            j.company,
            `Introduction to ${j.company}`,
            j.benefits ?? `Benefits at ${j.company}`,
            `Work style at ${j.company}`
          ]
        );
        const companyId = companyRes.rows[0].id;

        await client.query(
          `INSERT INTO job_postings
             (tenant_id, external_id, title, company_id, location_slugs, work_mode,
              salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
              job_type, experience_required_years, benefits, education_required)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
           DO UPDATE SET
             title = EXCLUDED.title, company_id = EXCLUDED.company_id,
             location_slugs = EXCLUDED.location_slugs,
             work_mode = EXCLUDED.work_mode, salary_min_vnd = EXCLUDED.salary_min_vnd,
             salary_max_vnd = EXCLUDED.salary_max_vnd, seniority = EXCLUDED.seniority,
             required_skills = EXCLUDED.required_skills, description = EXCLUDED.description,
             job_type = EXCLUDED.job_type, experience_required_years = EXCLUDED.experience_required_years,
             benefits = EXCLUDED.benefits, education_required = EXCLUDED.education_required,
             is_active = true`,
          [
            input.tenantId,
            j.externalId ?? null,
            j.title,
            companyId,
            j.locationSlugs,
            j.workMode,
            j.salaryMinVnd,
            j.salaryMaxVnd,
            j.seniority,
            j.requiredSkills,
            j.description,
            j.jobType ?? null,
            j.experienceRequiredYears ?? null,
            j.benefits ?? null,
            j.educationRequired ?? null,
          ],
        );
        inserted += 1;
      }
      return { inserted };
    },
  };
}

export interface GuestAccessRow {
  id: string;
  tenant_id: string;
  invite_code: string;
  status: "pending" | "claimed" | "revoked";
  password_hash: string | null;
  display_name: string | null;
  profile: Record<string, unknown>;
  contact_id: string | null;
  conversation_id: string | null;
  session_token_hash: string | null;
  created_at: string;
  claimed_at: string | null;
  last_seen_at: string | null;
}

export function createGuestAccessRepository(client: DatabaseClient) {
  return {
    async findById(id: string) {
      const res = await client.query(
        `SELECT id, tenant_id, invite_code, status, password_hash, display_name, profile, contact_id, conversation_id, session_token_hash, created_at, claimed_at, last_seen_at
         FROM public.guest_access
         WHERE id = $1
         LIMIT 1`,
        [id],
      );
      return (res.rows[0] as GuestAccessRow) || null;
    },
    async findByInviteCode(inviteCode: string) {
      const res = await client.query(
        `SELECT id, tenant_id, invite_code, status, password_hash, display_name, profile, contact_id, conversation_id, session_token_hash, created_at, claimed_at, last_seen_at
         FROM public.guest_access
         WHERE invite_code = $1
         LIMIT 1`,
        [inviteCode],
      );
      return (res.rows[0] as GuestAccessRow) || null;
    },
    async create(input: { tenantId: string; inviteCode: string }) {
      const res = await client.query(
        `INSERT INTO public.guest_access (tenant_id, invite_code, status, profile)
         VALUES ($1, $2, 'pending', '{}'::jsonb)
         RETURNING id, tenant_id, invite_code, status, password_hash, display_name, profile, contact_id, conversation_id, session_token_hash, created_at, claimed_at, last_seen_at`,
        [input.tenantId, input.inviteCode],
      );
      return res.rows[0] as GuestAccessRow;
    },
    async updateClaim(input: {
      inviteCode: string;
      passwordHash: string;
      displayName: string;
      profile: Record<string, unknown>;
      contactId: string;
      conversationId: string;
      sessionTokenHash: string;
    }) {
      const res = await client.query(
        `UPDATE public.guest_access
         SET status = 'claimed',
             password_hash = $1,
             display_name = $2,
             profile = $3,
             contact_id = $4,
             conversation_id = $5,
             session_token_hash = $6,
             claimed_at = now()
         WHERE invite_code = $7 AND status = 'pending'
         RETURNING id, tenant_id, invite_code, status, password_hash, display_name, profile, contact_id, conversation_id, session_token_hash, created_at, claimed_at, last_seen_at`,
        [
          input.passwordHash,
          input.displayName,
          JSON.stringify(input.profile),
          input.contactId,
          input.conversationId,
          input.sessionTokenHash,
          input.inviteCode,
        ],
      );
      return (res.rows[0] as GuestAccessRow) || null;
    },
    async updateSessionToken(input: { inviteCode: string; sessionTokenHash: string }) {
      const res = await client.query(
        `UPDATE public.guest_access
         SET session_token_hash = $1
         WHERE invite_code = $2
         RETURNING id, tenant_id, invite_code, status, password_hash, display_name, profile, contact_id, conversation_id, session_token_hash, created_at, claimed_at, last_seen_at`,
        [input.sessionTokenHash, input.inviteCode],
      );
      return (res.rows[0] as GuestAccessRow) || null;
    },
    async updateLastSeen(inviteCode: string) {
      await client.query(
        `UPDATE public.guest_access
         SET last_seen_at = now()
         WHERE invite_code = $1`,
        [inviteCode],
      );
    },
    async listByTenant(input: { tenantId: string; limit?: number }) {
      const res = await client.query(
        `SELECT id, tenant_id, invite_code, status, password_hash, display_name, profile, contact_id, conversation_id, session_token_hash, created_at, claimed_at, last_seen_at
         FROM public.guest_access
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [input.tenantId, input.limit ?? 100],
      );
      return res.rows as GuestAccessRow[];
    },
    async revoke(id: string) {
      const res = await client.query(
        `UPDATE public.guest_access
         SET status = 'revoked'
         WHERE id = $1
         RETURNING id, tenant_id, invite_code, status, password_hash, display_name, profile, contact_id, conversation_id, session_token_hash, created_at, claimed_at, last_seen_at`,
        [id],
      );
      return (res.rows[0] as GuestAccessRow) || null;
    },
  };
}

export interface DocumentRow {
  id: string;
  tenant_id: string;
  kind: "cv" | "jd";
  storage_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: string | null;
  status: "uploaded" | "processing" | "processed" | "failed";
  parse_method: string | null;
  raw_text: string | null;
  error: string | null;
  contact_id: string | null;
  guest_access_id: string | null;
  conversation_id: string | null;
  company_id: string | null;
  uploaded_by: "admin" | "guest" | "zalo";
  created_at: string;
  updated_at: string;
}

export function createDocumentRepository(client: DatabaseClient) {
  return {
    async create(input: {
      tenantId: string;
      kind: "cv" | "jd";
      storageKey: string;
      fileName: string;
      mimeType?: string;
      sizeBytes?: number;
      contactId?: string;
      guestAccessId?: string;
      conversationId?: string;
      companyId?: string;
      uploadedBy?: "admin" | "guest" | "zalo";
    }) {
      const res = await client.query(
        `INSERT INTO public.documents (
          tenant_id, kind, storage_key, file_name, mime_type, size_bytes,
          contact_id, guest_access_id, conversation_id, company_id, uploaded_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          input.tenantId,
          input.kind,
          input.storageKey,
          input.fileName,
          input.mimeType ?? "application/octet-stream",
          input.sizeBytes ?? null,
          input.contactId ?? null,
          input.guestAccessId ?? null,
          input.conversationId ?? null,
          input.companyId ?? null,
          input.uploadedBy ?? "admin",
        ]
      );
      return res.rows[0] as DocumentRow;
    },
    async findById(id: string) {
      const res = await client.query(
        `SELECT * FROM public.documents WHERE id = $1 LIMIT 1`,
        [id]
      );
      return (res.rows[0] as DocumentRow) || null;
    },
    async markUploaded(id: string, sizeBytes: number) {
      await client.query(
        `UPDATE public.documents 
         SET status = 'uploaded', size_bytes = $2, updated_at = now() 
         WHERE id = $1`,
        [id, sizeBytes]
      );
    },
    async markProcessing(id: string) {
      await client.query(
        `UPDATE public.documents 
         SET status = 'processing', updated_at = now() 
         WHERE id = $1`,
        [id]
      );
    },
    async markProcessed(input: { id: string; rawText: string; parseMethod: string }) {
      await client.query(
        `UPDATE public.documents 
         SET status = 'processed', raw_text = $2, parse_method = $3, error = null, updated_at = now() 
         WHERE id = $1`,
        [input.id, input.rawText, input.parseMethod]
      );
    },
    async markFailed(input: { id: string; error: string }) {
      await client.query(
        `UPDATE public.documents 
         SET status = 'failed', error = $2, updated_at = now() 
         WHERE id = $1`,
        [input.id, input.error]
      );
    },
    async listByTenant(input: { tenantId: string; kind?: "cv" | "jd"; limit?: number }) {
      let query = `SELECT * FROM public.documents WHERE tenant_id = $1`;
      const params: any[] = [input.tenantId];
      if (input.kind) {
        query += ` AND kind = $2`;
        params.push(input.kind);
      }
      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(input.limit ?? 100);

      const res = await client.query(query, params);
      return res.rows as DocumentRow[];
    }
  };
}


export interface CandidateProfileRow {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  guest_access_id: string | null;
  source_document_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  current_title: string | null;
  years_of_experience: number | null;
  skills: string[];
  preferred_roles: string[];
  salary_expectation_vnd: string | number | null;
  availability: string | null;
  work_history: any[];
  education: any[];
  languages: string[];
  summary: string;
  raw_extraction: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CandidateProfilePatch {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  currentTitle?: string | null;
  yearsOfExperience?: number | null;
  skills?: string[];
  preferredRoles?: string[];
  salaryExpectationVnd?: number | string | null;
  availability?: string | null;
  workHistory?: any[];
  education?: any[];
  languages?: string[];
  summary?: string;
  rawExtraction?: Record<string, any>;
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] === undefined) continue;
    if (source[key] === null) {
      result[key] = null;
    } else if (Array.isArray(source[key])) {
      result[key] = source[key];
    } else if (typeof source[key] === 'object' && source[key] !== null) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  if (target && target.notes && (!source || source.notes === undefined)) {
    result.notes = target.notes;
  }
  return result;
}

export function createCandidateProfileRepository(client: DatabaseClient) {
  return {
    async upsert(input: {
      tenantId: string;
      contactId?: string;
      guestAccessId?: string;
      sourceDocumentId?: string;
      patch: CandidateProfilePatch;
    }): Promise<CandidateProfileRow> {
      let existing: any = null;
      if (input.contactId) {
        const res = await client.query(
          `SELECT * FROM public.candidate_profiles WHERE tenant_id = $1 AND contact_id = $2 LIMIT 1`,
          [input.tenantId, input.contactId]
        );
        existing = res.rows[0];
      } else if (input.guestAccessId) {
        const res = await client.query(
          `SELECT * FROM public.candidate_profiles WHERE tenant_id = $1 AND guest_access_id = $2 LIMIT 1`,
          [input.tenantId, input.guestAccessId]
        );
        existing = res.rows[0];
      }

      if (existing) {
        const patch = input.patch;
        const merged = { ...existing };
        if (patch.fullName !== undefined && patch.fullName !== null) merged.full_name = patch.fullName;
        if (patch.email !== undefined && patch.email !== null) merged.email = patch.email;
        if (patch.phone !== undefined && patch.phone !== null) merged.phone = patch.phone;
        if (patch.location !== undefined && patch.location !== null) merged.location = patch.location;
        if (patch.currentTitle !== undefined && patch.currentTitle !== null) merged.current_title = patch.currentTitle;
        if (patch.yearsOfExperience !== undefined && patch.yearsOfExperience !== null) merged.years_of_experience = patch.yearsOfExperience;
        if (patch.skills !== undefined && patch.skills !== null) merged.skills = patch.skills;
        if (patch.preferredRoles !== undefined && patch.preferredRoles !== null) merged.preferred_roles = patch.preferredRoles;
        if (patch.salaryExpectationVnd !== undefined && patch.salaryExpectationVnd !== null) merged.salary_expectation_vnd = patch.salaryExpectationVnd;
        if (patch.availability !== undefined && patch.availability !== null) merged.availability = patch.availability;
        if (patch.workHistory !== undefined && patch.workHistory !== null) merged.work_history = patch.workHistory;
        if (patch.education !== undefined && patch.education !== null) merged.education = patch.education;
        if (patch.languages !== undefined && patch.languages !== null) merged.languages = patch.languages;
        if (patch.summary !== undefined && patch.summary !== null) merged.summary = patch.summary;
        if (patch.rawExtraction !== undefined && patch.rawExtraction !== null) {
          merged.raw_extraction = deepMerge(existing.raw_extraction || {}, patch.rawExtraction);
        }
        if (input.sourceDocumentId !== undefined && input.sourceDocumentId !== null) {
          merged.source_document_id = input.sourceDocumentId;
        }

        const res = await client.query(
          `UPDATE public.candidate_profiles SET
             source_document_id = $1,
             full_name = $2,
             email = $3,
             phone = $4,
             location = $5,
             current_title = $6,
             years_of_experience = $7,
             skills = $8,
             preferred_roles = $9,
             salary_expectation_vnd = $10,
             availability = $11,
             work_history = $12,
             education = $13,
             languages = $14,
             summary = $15,
             raw_extraction = $16,
             updated_at = now()
           WHERE id = $17
           RETURNING *`,
          [
            merged.source_document_id,
            merged.full_name,
            merged.email,
            merged.phone,
            merged.location,
            merged.current_title,
            merged.years_of_experience,
            merged.skills,
            merged.preferred_roles,
            merged.salary_expectation_vnd,
            merged.availability,
            JSON.stringify(merged.work_history),
            JSON.stringify(merged.education),
            merged.languages,
            merged.summary,
            JSON.stringify(merged.raw_extraction),
            existing.id
          ]
        );
        return res.rows[0] as CandidateProfileRow;
      } else {
        const patch = input.patch;
        const newRow = {
          tenant_id: input.tenantId,
          contact_id: input.contactId ?? null,
          guest_access_id: input.guestAccessId ?? null,
          source_document_id: input.sourceDocumentId ?? null,
          full_name: patch.fullName ?? null,
          email: patch.email ?? null,
          phone: patch.phone ?? null,
          location: patch.location ?? null,
          current_title: patch.currentTitle ?? null,
          years_of_experience: patch.yearsOfExperience ?? null,
          skills: patch.skills ?? [],
          preferred_roles: patch.preferredRoles ?? [],
          salary_expectation_vnd: patch.salaryExpectationVnd ?? null,
          availability: patch.availability ?? null,
          work_history: patch.workHistory ?? [],
          education: patch.education ?? [],
          languages: patch.languages ?? [],
          summary: patch.summary ?? "",
          raw_extraction: patch.rawExtraction ?? {},
        };

        const res = await client.query(
          `INSERT INTO public.candidate_profiles (
             tenant_id, contact_id, guest_access_id, source_document_id,
             full_name, email, phone, location, current_title, years_of_experience,
             skills, preferred_roles, salary_expectation_vnd, availability,
             work_history, education, languages, summary, raw_extraction
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
           RETURNING *`,
          [
            newRow.tenant_id,
            newRow.contact_id,
            newRow.guest_access_id,
            newRow.source_document_id,
            newRow.full_name,
            newRow.email,
            newRow.phone,
            newRow.location,
            newRow.current_title,
            newRow.years_of_experience,
            newRow.skills,
            newRow.preferred_roles,
            newRow.salary_expectation_vnd,
            newRow.availability,
            JSON.stringify(newRow.work_history),
            JSON.stringify(newRow.education),
            newRow.languages,
            newRow.summary,
            JSON.stringify(newRow.raw_extraction)
          ]
        );
        return res.rows[0] as CandidateProfileRow;
      }
    },

    async findByContact(input: { tenantId: string; contactId: string }) {
      const res = await client.query(
        `SELECT * FROM public.candidate_profiles WHERE tenant_id = $1 AND contact_id = $2 LIMIT 1`,
        [input.tenantId, input.contactId]
      );
      return (res.rows[0] as CandidateProfileRow) || null;
    },

    async findByGuest(input: { tenantId: string; guestAccessId: string }) {
      const res = await client.query(
        `SELECT * FROM public.candidate_profiles WHERE tenant_id = $1 AND guest_access_id = $2 LIMIT 1`,
        [input.tenantId, input.guestAccessId]
      );
      return (res.rows[0] as CandidateProfileRow) || null;
    },

    async findById(id: string) {
      const res = await client.query(
        `SELECT * FROM public.candidate_profiles WHERE id = $1 LIMIT 1`,
        [id]
      );
      return (res.rows[0] as CandidateProfileRow) || null;
    },

    async search(input: {
      tenantId: string;
      query?: string;
      skills?: string[];
      minYears?: number;
      location?: string;
      limit?: number;
    }) {
      let sql = 'SELECT * FROM public.candidate_profiles WHERE tenant_id = $1';
      const params: any[] = [input.tenantId];

      if (input.query && input.query.trim()) {
        params.push(input.query.trim());
        sql += ' AND search @@ websearch_to_tsquery(\'english\'::regconfig, $' + params.length + ')';
      }

      if (input.skills && input.skills.length > 0) {
        params.push(input.skills);
        sql += ' AND skills @> $' + params.length;
      }

      if (input.minYears !== undefined && input.minYears !== null) {
        params.push(input.minYears);
        sql += ' AND years_of_experience >= $' + params.length;
      }

      if (input.location && input.location.trim()) {
        params.push("%" + input.location.trim() + "%");
        sql += ' AND location ILIKE $' + params.length;
      }

      sql += ' ORDER BY created_at DESC';

      if (input.limit !== undefined && input.limit !== null) {
        params.push(input.limit);
        sql += ' LIMIT $' + params.length;
      } else {
        sql += ' LIMIT 50';
      }

      const res = await client.query(sql, params);
      return res.rows as CandidateProfileRow[];
    }
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
    jobs: createJobPostingRepository(client),
    companies: createCompanyRepository(client),
    guestAccess: createGuestAccessRepository(client),
    documents: createDocumentRepository(client),
    candidateProfiles: createCandidateProfileRepository(client),
  };
}
