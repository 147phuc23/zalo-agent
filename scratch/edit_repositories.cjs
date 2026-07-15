const fs = require('fs');

const repoPath = '/Users/phuc.dang/.gemini/antigravity/brain/bf79bbe4-c44d-40d7-a9a9-2f0dfdc4a4eb/.system_generated/worktrees/subagent-CV-to-Profile-Developer-self-de111789/packages/database/src/repositories.ts';

let content = fs.readFileSync(repoPath, 'utf8');

// 1. Replace createRepositorySet first
const oldRepositorySet = `export function createRepositorySet(client: DatabaseClient) {
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
}`;

const repositorySetContent = `export function createRepositorySet(client: DatabaseClient) {
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
}`;

if (!content.includes(oldRepositorySet)) {
  console.error("Target for oldRepositorySet not found!");
  process.exit(1);
}
content = content.replace(oldRepositorySet, () => repositorySetContent);

// 2. Add findById to createContactRepository
const contactTarget = 'export function createContactRepository(client: DatabaseClient) {\n  return {\n    async findByExternalUser(input: {\n      tenantId: string;\n      channel: string;\n      externalUserId: string;\n    }) {';

const contactReplacement = `export function createContactRepository(client: DatabaseClient) {
  return {
    async findById(id: string) {
      const res = await client.query(
        \`SELECT id, tenant_id, channel, external_user_id, display_name, phone, metadata, created_at 
         FROM contacts 
         WHERE id = $1 
         LIMIT 1\`,
        [id],
      );
      return (res.rows[0] as ContactRow) || null;
    },
    async findByExternalUser(input: {
      tenantId: string;
      channel: string;
      externalUserId: string;
    }) {`;

if (!content.includes(contactTarget)) {
  console.error("Target for createContactRepository not found!");
  process.exit(1);
}
content = content.replace(contactTarget, () => contactReplacement);

// 3. Add CandidateProfileRow interface, CandidateProfilePatch interface and createCandidateProfileRepository
const candidateProfileCode = `
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
          \`SELECT * FROM public.candidate_profiles WHERE tenant_id = $1 AND contact_id = $2 LIMIT 1\`,
          [input.tenantId, input.contactId]
        );
        existing = res.rows[0];
      } else if (input.guestAccessId) {
        const res = await client.query(
          \`SELECT * FROM public.candidate_profiles WHERE tenant_id = $1 AND guest_access_id = $2 LIMIT 1\`,
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
          \`UPDATE public.candidate_profiles SET
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
           RETURNING *\`,
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
          \`INSERT INTO public.candidate_profiles (
             tenant_id, contact_id, guest_access_id, source_document_id,
             full_name, email, phone, location, current_title, years_of_experience,
             skills, preferred_roles, salary_expectation_vnd, availability,
             work_history, education, languages, summary, raw_extraction
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
           RETURNING *\`,
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
        \`SELECT * FROM public.candidate_profiles WHERE tenant_id = $1 AND contact_id = $2 LIMIT 1\`,
        [input.tenantId, input.contactId]
      );
      return (res.rows[0] as CandidateProfileRow) || null;
    },

    async findByGuest(input: { tenantId: string; guestAccessId: string }) {
      const res = await client.query(
        \`SELECT * FROM public.candidate_profiles WHERE tenant_id = $1 AND guest_access_id = $2 LIMIT 1\`,
        [input.tenantId, input.guestAccessId]
      );
      return (res.rows[0] as CandidateProfileRow) || null;
    },

    async findById(id: string) {
      const res = await client.query(
        \`SELECT * FROM public.candidate_profiles WHERE id = $1 LIMIT 1\`,
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
      const params = [input.tenantId];

      if (input.query && input.query.trim()) {
        params.push(input.query.trim());
        sql += ' AND search @@ websearch_to_tsquery(\\'english\\'::regconfig, $' + params.length + ')';
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
`;

// Insert CandidateProfileRow, CandidateProfilePatch, deepMerge and createCandidateProfileRepository at the end of the file (before export function createRepositorySet)
const repositorySetTarget = 'export function createRepositorySet(client: DatabaseClient) {';
if (!content.includes(repositorySetTarget)) {
  console.error("Target for createRepositorySet not found!");
  process.exit(1);
}
content = content.replace(repositorySetTarget, () => candidateProfileCode + '\n' + repositorySetTarget);

// Add typing to params
content = content.replace('const params = [input.tenantId];', 'const params: any[] = [input.tenantId];');

fs.writeFileSync(repoPath, content, 'utf8');
console.log("Successfully edited repositories.ts!");
