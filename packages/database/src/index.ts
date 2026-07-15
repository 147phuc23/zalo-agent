import pg from "pg";

export { runMigrations } from "./migrator.js";
export {
  createAuditRepository,
  createContactRepository,
  createConversationRepository,
  createDeliveryRepository,
  createHumanTaskRepository,
  createMessageRepository,
  createRepositorySet,
  createTenantRepository,
  createWorkflowConfigRepository,
  createPromptTemplateRepository,
  createJobPostingRepository,
  createGuestAccessRepository,
  createCompanyRepository,
  createDocumentRepository,
} from "./repositories.js";

export type {
  TenantRow,
  UserRow,
  TenantUserRow,
  ChannelAccountRow,
  ContactRow,
  ConversationRow,
  MessageRow,
  MessageDeliveryRow,
  WorkflowConfigRow,
  ToolCallAuditRow,
  HumanTaskRow,
  PromptTemplateRow,
  JobPostingRow,
  GuestAccessRow,
  CompanyRow,
  DocumentRow,
} from "./repositories.js";

export type DatabaseClient = pg.Pool;

export function createDatabaseClient(input: {
  PLATFORM_DB_URL: string;
}) {
  return new pg.Pool({
    connectionString: input.PLATFORM_DB_URL,
    // Serverless: each instance handles one request at a time, so a single
    // connection is enough. Keeps us well under Neon's connection limit.
    max: 1,
  });
}
