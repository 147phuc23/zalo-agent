export function createTenantRepository(client) {
    return {
        async ensureExists(input) {
            const existing = await client.query("SELECT id FROM tenants WHERE id = $1 LIMIT 1", [input.tenantId]);
            if (!existing.rows[0]) {
                await client.query("INSERT INTO tenants (id, name, timezone, locale, status) VALUES ($1, $2, $3, $4, 'active')", [input.tenantId, input.name, input.timezone, input.locale]);
            }
        },
    };
}
export function createContactRepository(client) {
    return {
        async findByExternalUser(input) {
            const res = await client.query(`SELECT id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at 
         FROM contacts 
         WHERE tenant_id = $1 AND channel = $2 AND external_user_id = $3 
         LIMIT 1`, [input.tenantId, input.channel, input.externalUserId]);
            return res.rows[0] || null;
        },
        async listByIds(input) {
            if (input.ids.length === 0)
                return [];
            const res = await client.query(`SELECT id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at 
         FROM contacts 
         WHERE id = ANY($1)`, [input.ids]);
            return res.rows;
        },
        async createShadow(input) {
            const res = await client.query(`INSERT INTO contacts (tenant_id, channel, external_user_id, display_name, phone, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at`, [
                input.tenantId,
                input.channel,
                input.externalUserId,
                input.displayName ?? null,
                input.phone ?? null,
                JSON.stringify(input.metadata ?? {}),
            ]);
            return res.rows[0];
        },
    };
}
export function createConversationRepository(client) {
    return {
        async findByExternalThread(input) {
            const res = await client.query(`SELECT id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at, created_at 
         FROM conversations 
         WHERE tenant_id = $1 AND channel = $2 AND external_thread_id = $3 
         LIMIT 1`, [input.tenantId, input.channel, input.externalThreadId]);
            return res.rows[0] || null;
        },
        async findById(conversationId) {
            const res = await client.query(`SELECT id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at, created_at 
         FROM conversations 
         WHERE id = $1 
         LIMIT 1`, [conversationId]);
            return res.rows[0] || null;
        },
        async listByTenant(input) {
            const res = await client.query(`SELECT id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at, created_at 
         FROM conversations 
         WHERE tenant_id = $1 
         ORDER BY last_activity_at DESC 
         LIMIT $2`, [input.tenantId, input.limit]);
            return res.rows;
        },
        async create(input) {
            const res = await client.query(`INSERT INTO conversations (tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, override_model, last_activity_at, created_at`, [
                input.tenantId,
                input.channel,
                input.externalThreadId,
                input.contactId,
                input.status ?? "open",
                input.assigneeUserId ?? null,
                input.overrideModel ?? null,
                input.lastActivityAt ?? new Date().toISOString(),
            ]);
            return res.rows[0];
        },
        async updateLastActivity(conversationId, lastActivityAt) {
            await client.query("UPDATE conversations SET last_activity_at = $1 WHERE id = $2", [lastActivityAt, conversationId]);
        },
        async updateAssignee(conversationId, assigneeUserId) {
            await client.query("UPDATE conversations SET assignee_user_id = $1 WHERE id = $2", [assigneeUserId, conversationId]);
        },
        async updateStatus(conversationId, status) {
            await client.query("UPDATE conversations SET status = $1 WHERE id = $2", [status, conversationId]);
        },
        async updateOverrideModel(conversationId, overrideModel) {
            await client.query("UPDATE conversations SET override_model = $1 WHERE id = $2", [overrideModel, conversationId]);
        },
    };
}
export function createMessageRepository(client) {
    return {
        async listByConversation(input) {
            const res = await client.query(`SELECT id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read, read_at, created_at 
         FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`, [input.conversationId, input.limit]);
            return res.rows.reverse();
        },
        async findLatestByExternalMessageId(input) {
            const res = await client.query(`SELECT id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read, read_at, created_at 
         FROM messages 
         WHERE tenant_id = $1 AND external_message_id = $2 
         ORDER BY created_at DESC 
         LIMIT 1`, [input.tenantId, input.externalMessageId]);
            return res.rows[0] || null;
        },
        async createInbound(input) {
            await client.query(`INSERT INTO messages (tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read)
         VALUES ($1, $2, 'inbound', $3, $4, $5, $6, $7, false)`, [
                input.tenantId,
                input.conversationId,
                input.messageType,
                input.text ?? null,
                input.externalMessageId ?? null,
                input.idempotencyKey,
                JSON.stringify(input.rawPayload),
            ]);
        },
        async createOutbound(input) {
            await client.query(`INSERT INTO messages (tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, is_read, read_at)
         VALUES ($1, $2, 'outbound', $3, $4, $5, $6, $7, true, NOW())`, [
                input.tenantId,
                input.conversationId,
                input.messageType,
                input.text,
                input.externalMessageId ?? null,
                input.idempotencyKey,
                JSON.stringify(input.rawPayload),
            ]);
        },
        async markAsRead(conversationId) {
            await client.query("UPDATE messages SET is_read = true, read_at = NOW() WHERE conversation_id = $1 AND direction = 'inbound' AND is_read = false", [conversationId]);
        },
    };
}
export function createDeliveryRepository(client) {
    return {
        async create(input) {
            await client.query(`INSERT INTO message_deliveries (tenant_id, message_id, attempt, status, error_code, error_message, provider_payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                input.tenantId,
                input.messageId,
                input.attempt ?? 1,
                input.status,
                input.errorCode ?? null,
                input.errorMessage ?? null,
                JSON.stringify(input.providerPayload ?? {}),
            ]);
        },
    };
}
export function createWorkflowConfigRepository(client) {
    return {
        async findLatestByTenant(tenantId) {
            const res = await client.query(`SELECT id, tenant_id, mode, default_model, classifier_model, embedding_model, max_tool_turns, temperature, prompt_settings, crm_mapping, blocked_topics, created_at 
         FROM workflow_configs 
         WHERE tenant_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`, [tenantId]);
            return res.rows[0] || null;
        },
    };
}
export function createHumanTaskRepository(client) {
    return {
        async create(input) {
            await client.query(`INSERT INTO human_tasks (tenant_id, conversation_id, type, status, payload)
         VALUES ($1, $2, $3, $4, $5)`, [
                input.tenantId,
                input.conversationId ?? null,
                input.type,
                input.status ?? "open",
                JSON.stringify(input.payload ?? {}),
            ]);
        },
    };
}
export function createAuditRepository(client) {
    return {
        async append(input) {
            await client.query(`INSERT INTO tool_call_audits (tenant_id, conversation_id, run_id, tool_name, input, output, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                input.tenantId,
                input.conversationId ?? null,
                input.runId ?? null,
                input.toolName,
                JSON.stringify(input.inputPayload ?? {}),
                input.outputPayload === null ? null : JSON.stringify(input.outputPayload ?? {}),
                input.status ?? "ok",
            ]);
        },
        async listByConversation(conversationId) {
            const res = await client.query(`SELECT id, tenant_id, conversation_id, run_id, tool_name, input, output, status, created_at 
         FROM tool_call_audits 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC`, [conversationId]);
            return res.rows;
        },
    };
}
export function createPromptTemplateRepository(client) {
    return {
        async findActive(input) {
            const res = await client.query(`SELECT id, tenant_id, key, content, version, is_active, created_at 
         FROM prompt_templates 
         WHERE tenant_id = $1 AND key = $2 AND is_active = true 
         LIMIT 1`, [input.tenantId, input.key]);
            return res.rows[0] || null;
        },
        async create(input) {
            await client.query("UPDATE prompt_templates SET is_active = false WHERE tenant_id = $1 AND key = $2", [input.tenantId, input.key]);
            const res = await client.query(`INSERT INTO prompt_templates (tenant_id, key, content, version, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, tenant_id, key, content, version, is_active, created_at`, [input.tenantId, input.key, input.content, input.version]);
            return res.rows[0];
        },
        async listVersions(input) {
            const res = await client.query(`SELECT id, tenant_id, key, content, version, is_active, created_at 
         FROM prompt_templates 
         WHERE tenant_id = $1 AND key = $2 
         ORDER BY version DESC`, [input.tenantId, input.key]);
            return res.rows;
        },
    };
}
export function createRepositorySet(client) {
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
