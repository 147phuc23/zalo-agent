function toJson(value) {
    return value;
}
export function createTenantRepository(client) {
    return {
        async ensureExists(input) {
            const existing = await client.from("tenants").select("id").eq("id", input.tenantId).maybeSingle();
            if (existing.error) {
                throw new Error(existing.error.message);
            }
            if (!existing.data) {
                const inserted = await client.from("tenants").insert({
                    id: input.tenantId,
                    name: input.name,
                    timezone: input.timezone,
                    locale: input.locale,
                    status: "active",
                });
                if (inserted.error) {
                    throw new Error(inserted.error.message);
                }
            }
        },
    };
}
export function createContactRepository(client) {
    return {
        async findByExternalUser(input) {
            const result = await client
                .from("contacts")
                .select("id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at")
                .eq("tenant_id", input.tenantId)
                .eq("channel", input.channel)
                .eq("external_user_id", input.externalUserId)
                .maybeSingle();
            if (result.error) {
                throw new Error(result.error.message);
            }
            return result.data;
        },
        async listByIds(input) {
            if (input.ids.length === 0) {
                return [];
            }
            const result = await client
                .from("contacts")
                .select("id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at")
                .in("id", input.ids);
            if (result.error) {
                throw new Error(result.error.message);
            }
            return (result.data ?? []);
        },
        async createShadow(input) {
            const result = await client
                .from("contacts")
                .insert({
                tenant_id: input.tenantId,
                channel: input.channel,
                external_user_id: input.externalUserId,
                display_name: input.displayName ?? null,
                phone: input.phone ?? null,
                metadata: toJson(input.metadata ?? {}),
            })
                .select("id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at")
                .single();
            if (result.error) {
                throw new Error(result.error.message);
            }
            return result.data;
        },
    };
}
export function createConversationRepository(client) {
    return {
        async findByExternalThread(input) {
            const result = await client
                .from("conversations")
                .select("id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, last_activity_at, created_at")
                .eq("tenant_id", input.tenantId)
                .eq("channel", input.channel)
                .eq("external_thread_id", input.externalThreadId)
                .maybeSingle();
            if (result.error) {
                throw new Error(result.error.message);
            }
            return result.data;
        },
        async findById(conversationId) {
            const result = await client
                .from("conversations")
                .select("id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, last_activity_at, created_at")
                .eq("id", conversationId)
                .maybeSingle();
            if (result.error) {
                throw new Error(result.error.message);
            }
            return result.data;
        },
        async listByTenant(input) {
            const result = await client
                .from("conversations")
                .select("id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, last_activity_at, created_at")
                .eq("tenant_id", input.tenantId)
                .order("last_activity_at", { ascending: false })
                .limit(input.limit);
            if (result.error) {
                throw new Error(result.error.message);
            }
            return (result.data ?? []);
        },
        async create(input) {
            const result = await client
                .from("conversations")
                .insert({
                tenant_id: input.tenantId,
                channel: input.channel,
                external_thread_id: input.externalThreadId,
                contact_id: input.contactId,
                status: input.status ?? "open",
                assignee_user_id: input.assigneeUserId ?? null,
                last_activity_at: input.lastActivityAt ?? new Date().toISOString(),
            })
                .select("id, tenant_id, channel, external_thread_id, contact_id, status, assignee_user_id, last_activity_at, created_at")
                .single();
            if (result.error) {
                throw new Error(result.error.message);
            }
            return result.data;
        },
        async updateLastActivity(conversationId, lastActivityAt) {
            const result = await client
                .from("conversations")
                .update({ last_activity_at: lastActivityAt })
                .eq("id", conversationId);
            if (result.error) {
                throw new Error(result.error.message);
            }
        },
        async updateAssignee(conversationId, assigneeUserId) {
            const result = await client
                .from("conversations")
                .update({ assignee_user_id: assigneeUserId })
                .eq("id", conversationId);
            if (result.error) {
                throw new Error(result.error.message);
            }
        },
        async updateStatus(conversationId, status) {
            const result = await client.from("conversations").update({ status }).eq("id", conversationId);
            if (result.error) {
                throw new Error(result.error.message);
            }
        },
    };
}
export function createMessageRepository(client) {
    return {
        async listByConversation(input) {
            const result = await client
                .from("messages")
                .select("id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, created_at")
                .eq("conversation_id", input.conversationId)
                .order("created_at", { ascending: false })
                .limit(input.limit);
            if (result.error) {
                throw new Error(result.error.message);
            }
            return (result.data ?? []).reverse();
        },
        async findLatestByExternalMessageId(input) {
            const result = await client
                .from("messages")
                .select("id, tenant_id, conversation_id, direction, message_type, text, external_message_id, idempotency_key, raw_payload, created_at")
                .eq("tenant_id", input.tenantId)
                .eq("external_message_id", input.externalMessageId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (result.error) {
                throw new Error(result.error.message);
            }
            return result.data;
        },
        async createInbound(input) {
            const result = await client.from("messages").insert({
                tenant_id: input.tenantId,
                conversation_id: input.conversationId,
                direction: "inbound",
                message_type: input.messageType,
                text: input.text ?? null,
                external_message_id: input.externalMessageId ?? null,
                idempotency_key: input.idempotencyKey,
                raw_payload: toJson(input.rawPayload),
            });
            if (result.error) {
                throw new Error(result.error.message);
            }
        },
        async createOutbound(input) {
            const result = await client.from("messages").insert({
                tenant_id: input.tenantId,
                conversation_id: input.conversationId,
                direction: "outbound",
                message_type: input.messageType,
                text: input.text,
                external_message_id: input.externalMessageId ?? null,
                idempotency_key: input.idempotencyKey,
                raw_payload: toJson(input.rawPayload),
            });
            if (result.error) {
                throw new Error(result.error.message);
            }
        },
    };
}
export function createDeliveryRepository(client) {
    return {
        async create(input) {
            const result = await client.from("message_deliveries").insert({
                tenant_id: input.tenantId,
                message_id: input.messageId,
                attempt: input.attempt ?? 1,
                status: input.status,
                error_code: input.errorCode ?? null,
                error_message: input.errorMessage ?? null,
                provider_payload: toJson(input.providerPayload ?? {}),
            });
            if (result.error) {
                throw new Error(result.error.message);
            }
        },
    };
}
export function createWorkflowConfigRepository(client) {
    return {
        async findLatestByTenant(tenantId) {
            const result = await client
                .from("workflow_configs")
                .select("id, tenant_id, mode, default_model, classifier_model, embedding_model, max_tool_turns, temperature, prompt_settings, crm_mapping, blocked_topics, created_at")
                .eq("tenant_id", tenantId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (result.error) {
                throw new Error(result.error.message);
            }
            return result.data;
        },
    };
}
export function createHumanTaskRepository(client) {
    return {
        async create(input) {
            const result = await client.from("human_tasks").insert({
                tenant_id: input.tenantId,
                conversation_id: input.conversationId ?? null,
                type: input.type,
                status: input.status ?? "open",
                payload: toJson(input.payload ?? {}),
            });
            if (result.error) {
                throw new Error(result.error.message);
            }
        },
    };
}
export function createAuditRepository(client) {
    return {
        async append(input) {
            const result = await client.from("tool_call_audits").insert({
                tenant_id: input.tenantId,
                conversation_id: input.conversationId ?? null,
                run_id: input.runId ?? null,
                tool_name: input.toolName,
                input: toJson(input.inputPayload ?? {}),
                output: input.outputPayload === null ? null : toJson(input.outputPayload ?? {}),
                status: input.status ?? "ok",
            });
            if (result.error) {
                throw new Error(result.error.message);
            }
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
    };
}
