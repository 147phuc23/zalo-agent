import pg from "pg";
export { runMigrations } from "./migrator.js";
export { createAuditRepository, createContactRepository, createConversationRepository, createDeliveryRepository, createHumanTaskRepository, createMessageRepository, createRepositorySet, createTenantRepository, createWorkflowConfigRepository, createPromptTemplateRepository, } from "./repositories.js";
export function createDatabaseClient(input) {
    return new pg.Pool({
        connectionString: input.PLATFORM_DB_URL,
    });
}
