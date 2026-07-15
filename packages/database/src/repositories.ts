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
    async findById(id: string) {
      const res = await client.query(
        `SELECT * FROM companies WHERE id = $1`,
        [id]
      );
      return (res.rows[0] as CompanyRow) || null;
    },
    async listAll(input: { tenantId: string }) {
      const res = await client.query(
        `SELECT * FROM companies WHERE tenant_id = $1 ORDER BY name ASC`,
        [input.tenantId]
      );
      return res.rows as CompanyRow[];
    },
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
  status: "draft" | "active" | "archived";
  source_document_id: string | null;
  created_at: string;
}

export function createJobPostingRepository(client: DatabaseClient) {
  return {
    async findByIdOrExternalId(input: { tenantId: string; idOrExternalId: string }) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.idOrExternalId);
      const res = await client.query(
        `SELECT jp.*, c.name AS company, c.introduction AS company_introduction, c.benefits AS company_benefits, c.work_style AS company_work_style
         FROM job_postings jp
         LEFT JOIN companies c ON jp.company_id = c.id
         WHERE jp.tenant_id = $1 AND (${isUuid ? "jp.id = $2::uuid" : "false"} OR jp.external_id = $2::text)
         LIMIT 1`,
        [input.tenantId, input.idOrExternalId]
      );
      return (res.rows[0] as JobPostingRow) || null;
    },
    async createDraft(input: {
      tenantId: string;
      sourceDocumentId: string | null;
      fields: {
        title: string;
        company: string;
        locationSlugs: string[];
        workMode: "remote" | "hybrid" | "onsite";
        salaryMinVnd?: number;
        salaryMaxVnd?: number;
        seniority: string;
        requiredSkills: string[];
        description: string;
        jobType?: string | null;
        experienceRequiredYears?: number | null;
        benefits?: string | null;
        educationRequired?: string | null;
      };
    }) {
      const companyRes = await client.query(
        `INSERT INTO companies (tenant_id, name, introduction, benefits, work_style)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [
          input.tenantId,
          input.fields.company,
          `Introduction to ${input.fields.company}`,
          input.fields.benefits ?? `Benefits at ${input.fields.company}`,
          `Work style at ${input.fields.company}`
        ]
      );
      const companyId = companyRes.rows[0].id;

      const res = await client.query(
        `INSERT INTO job_postings
           (tenant_id, source_document_id, title, company_id, location_slugs, work_mode,
            salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
            job_type, experience_required_years, benefits, education_required, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft')
         RETURNING id`,
        [
          input.tenantId,
          input.sourceDocumentId,
          input.fields.title,
          companyId,
          input.fields.locationSlugs || [],
          input.fields.workMode || 'hybrid',
          input.fields.salaryMinVnd ?? 0,
          input.fields.salaryMaxVnd ?? 0,
          input.fields.seniority || '',
          input.fields.requiredSkills || [],
          input.fields.description || '',
          input.fields.jobType ?? null,
          input.fields.experienceRequiredYears ?? null,
          input.fields.benefits ?? null,
          input.fields.educationRequired ?? null,
        ]
      );
      const id = res.rows[0].id;
      return (await this.findByIdOrExternalId({ tenantId: input.tenantId, idOrExternalId: id }))!;
    },
    async updateFields(input: { id: string; patch: Partial<JobPostingRow & { company: string }> }) {
      let companyId: string | undefined;
      if (input.patch.company !== undefined) {
        const existingJob = await client.query("SELECT tenant_id FROM job_postings WHERE id = $1", [input.id]);
        if (existingJob.rows.length === 0) {
          throw new Error(`Job posting not found: ${input.id}`);
        }
        const tenantId = existingJob.rows[0].tenant_id;
        const companyRes = await client.query(
          `INSERT INTO companies (tenant_id, name, introduction, benefits, work_style)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [
            tenantId,
            input.patch.company,
            `Introduction to ${input.patch.company}`,
            input.patch.benefits ?? `Benefits at ${input.patch.company}`,
            `Work style at ${input.patch.company}`
          ]
        );
        companyId = companyRes.rows[0].id;
      }

      const setClause: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (input.patch.title !== undefined) {
        setClause.push(`title = $${paramIndex++}`);
        values.push(input.patch.title);
      }
      if (companyId !== undefined) {
        setClause.push(`company_id = $${paramIndex++}`);
        values.push(companyId);
      }
      if (input.patch.location_slugs !== undefined) {
        setClause.push(`location_slugs = $${paramIndex++}`);
        values.push(input.patch.location_slugs);
      } else if ((input.patch as any).locationSlugs !== undefined) {
        setClause.push(`location_slugs = $${paramIndex++}`);
        values.push((input.patch as any).locationSlugs);
      }
      if (input.patch.work_mode !== undefined) {
        setClause.push(`work_mode = $${paramIndex++}`);
        values.push(input.patch.work_mode);
      } else if ((input.patch as any).workMode !== undefined) {
        setClause.push(`work_mode = $${paramIndex++}`);
        values.push((input.patch as any).workMode);
      }
      if (input.patch.salary_min_vnd !== undefined) {
        setClause.push(`salary_min_vnd = $${paramIndex++}`);
        values.push(input.patch.salary_min_vnd);
      } else if ((input.patch as any).salaryMinVnd !== undefined) {
        setClause.push(`salary_min_vnd = $${paramIndex++}`);
        values.push((input.patch as any).salaryMinVnd);
      }
      if (input.patch.salary_max_vnd !== undefined) {
        setClause.push(`salary_max_vnd = $${paramIndex++}`);
        values.push(input.patch.salary_max_vnd);
      } else if ((input.patch as any).salaryMaxVnd !== undefined) {
        setClause.push(`salary_max_vnd = $${paramIndex++}`);
        values.push((input.patch as any).salaryMaxVnd);
      }
      if (input.patch.seniority !== undefined) {
        setClause.push(`seniority = $${paramIndex++}`);
        values.push(input.patch.seniority);
      }
      if (input.patch.required_skills !== undefined) {
        setClause.push(`required_skills = $${paramIndex++}`);
        values.push(input.patch.required_skills);
      } else if ((input.patch as any).requiredSkills !== undefined) {
        setClause.push(`required_skills = $${paramIndex++}`);
        values.push((input.patch as any).requiredSkills);
      }
      if (input.patch.description !== undefined) {
        setClause.push(`description = $${paramIndex++}`);
        values.push(input.patch.description);
      }
      if (input.patch.job_type !== undefined) {
        setClause.push(`job_type = $${paramIndex++}`);
        values.push(input.patch.job_type);
      } else if ((input.patch as any).jobType !== undefined) {
        setClause.push(`job_type = $${paramIndex++}`);
        values.push((input.patch as any).jobType);
      }
      if (input.patch.experience_required_years !== undefined) {
        setClause.push(`experience_required_years = $${paramIndex++}`);
        values.push(input.patch.experience_required_years);
      } else if ((input.patch as any).experienceRequiredYears !== undefined) {
        setClause.push(`experience_required_years = $${paramIndex++}`);
        values.push((input.patch as any).experienceRequiredYears);
      }
      if (input.patch.benefits !== undefined) {
        setClause.push(`benefits = $${paramIndex++}`);
        values.push(input.patch.benefits);
      }
      if (input.patch.education_required !== undefined) {
        setClause.push(`education_required = $${paramIndex++}`);
        values.push(input.patch.education_required);
      } else if ((input.patch as any).educationRequired !== undefined) {
        setClause.push(`education_required = $${paramIndex++}`);
        values.push((input.patch as any).educationRequired);
      }

      if (setClause.length === 0) {
        const existing = await client.query("SELECT tenant_id FROM job_postings WHERE id = $1", [input.id]);
        if (existing.rows.length === 0) {
          throw new Error(`Job posting not found: ${input.id}`);
        }
        return (await this.findByIdOrExternalId({ tenantId: existing.rows[0].tenant_id, idOrExternalId: input.id }))!;
      }

      values.push(input.id);
      const updateQuery = `UPDATE job_postings SET ${setClause.join(", ")} WHERE id = $${paramIndex++} RETURNING tenant_id`;
      const res = await client.query(updateQuery, values);
      if (res.rows.length === 0) {
        throw new Error(`Job posting not found: ${input.id}`);
      }
      const tenantId = res.rows[0].tenant_id;
      return (await this.findByIdOrExternalId({ tenantId, idOrExternalId: input.id }))!;
    },
    async setStatus(input: { id: string; status: "draft" | "active" | "archived" }) {
      const res = await client.query(
        "UPDATE job_postings SET status = $1 WHERE id = $2",
        [input.status, input.id]
      );
      if (res.rowCount === 0) {
        throw new Error(`Job posting not found: ${input.id}`);
      }
    },
    async listByStatus(input: { tenantId: string; status: "draft" | "active" | "archived"; limit?: number }) {
      const res = await client.query(
        `SELECT jp.*, c.name AS company, c.introduction AS company_introduction, c.benefits AS company_benefits, c.work_style AS company_work_style
         FROM job_postings jp
         LEFT JOIN companies c ON jp.company_id = c.id
         WHERE jp.tenant_id = $1 AND jp.status = $2
         ORDER BY jp.created_at DESC
         LIMIT $3`,
        [input.tenantId, input.status, input.limit ?? 500]
      );
      return res.rows as JobPostingRow[];
    },
    async listActive(input: { tenantId: string; limit?: number }) {
      const res = await client.query(
        `SELECT jp.*, c.name AS company, c.introduction AS company_introduction, c.benefits AS company_benefits, c.work_style AS company_work_style
         FROM job_postings jp
         LEFT JOIN companies c ON jp.company_id = c.id
         WHERE jp.tenant_id = $1 AND jp.status = 'active'
         ORDER BY jp.created_at DESC
         LIMIT $2`,
        [input.tenantId, input.limit ?? 500],
      );
      return res.rows as JobPostingRow[];
    },
    async count(input: { tenantId: string }) {
      const res = await client.query(
        "SELECT COUNT(*)::int AS n FROM job_postings WHERE tenant_id = $1 AND status = 'active'",
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
              job_type, experience_required_years, benefits, education_required, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active')
           ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
           DO UPDATE SET
             title = EXCLUDED.title, company_id = EXCLUDED.company_id,
             location_slugs = EXCLUDED.location_slugs,
             work_mode = EXCLUDED.work_mode, salary_min_vnd = EXCLUDED.salary_min_vnd,
             salary_max_vnd = EXCLUDED.salary_max_vnd, seniority = EXCLUDED.seniority,
             required_skills = EXCLUDED.required_skills, description = EXCLUDED.description,
             job_type = EXCLUDED.job_type, experience_required_years = EXCLUDED.experience_required_years,
             benefits = EXCLUDED.benefits, education_required = EXCLUDED.education_required,
             status = 'active'`,
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
  };
}
