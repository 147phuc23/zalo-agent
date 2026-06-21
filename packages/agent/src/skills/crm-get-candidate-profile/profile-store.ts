import type { CandidateProfile, Channel } from "../../types.js";

export type CandidateProfilePatch = Partial<Pick<
  CandidateProfile,
  | "displayName"
  | "phone"
  | "email"
  | "location"
  | "yearsOfExperience"
  | "currentTitle"
  | "skills"
  | "preferredRoles"
  | "salaryExpectationVnd"
  | "availability"
>>;

export type CandidateProfileNote = {
  content: string;
  source?: string;
  createdAt: string;
};

const seedProfiles: Record<string, CandidateProfile> = {
  "zalo-candidate-frontend": {
    externalUserId: "zalo-candidate-frontend",
    displayName: "Minh Nguyen",
    phone: "+84901234567",
    email: "minh.nguyen@example.local",
    location: "Ho Chi Minh City",
    yearsOfExperience: 3,
    currentTitle: "Frontend Engineer",
    skills: ["React", "TypeScript", "Next.js"],
    preferredRoles: ["Frontend Engineer", "Full-stack Engineer"],
    salaryExpectationVnd: 45_000_000,
    availability: "2 weeks",
    notes: ["Previously asked for product companies", "Prefers hybrid teams"],
  },
  "zalo-candidate-backend": {
    externalUserId: "zalo-candidate-backend",
    displayName: "Linh Tran",
    location: "Ha Noi",
    yearsOfExperience: 5,
    currentTitle: "Backend Engineer",
    skills: ["Node.js", "NestJS", "PostgreSQL"],
    preferredRoles: ["Backend Engineer"],
    salaryExpectationVnd: 60_000_000,
    availability: "immediate",
  },
};

let profiles = cloneProfiles(seedProfiles);
let revision = 0;

export function getMockCandidateProfile(input: {
  tenantId?: string;
  channel?: Channel;
  externalUserId: string;
}): CandidateProfile {
  const profile = profiles[input.externalUserId] ?? createUnknownProfile(input.externalUserId);
  return cloneProfile(profile);
}

export function updateMockCandidateProfile(input: {
  tenantId: string;
  channel: Channel;
  externalUserId: string;
  patch: CandidateProfilePatch;
}) {
  const existing = profiles[input.externalUserId];
  const created = !existing;
  const base = existing ?? createUnknownProfile(input.externalUserId);

  profiles[input.externalUserId] = {
    ...base,
    ...withoutArrayFields(input.patch),
    skills: mergeUnique(base.skills, input.patch.skills),
    preferredRoles: mergeUnique(base.preferredRoles, input.patch.preferredRoles),
    notes: [...(base.notes ?? [])],
  };
  revision += 1;

  return {
    created,
    profile: cloneProfile(profiles[input.externalUserId]),
  };
}

export function addMockCandidateProfileNote(input: {
  tenantId: string;
  channel: Channel;
  externalUserId: string;
  note: string;
  source?: string;
}) {
  const existing = profiles[input.externalUserId];
  const created = !existing;
  const base = existing ?? createUnknownProfile(input.externalUserId);
  const note: CandidateProfileNote = {
    content: input.note,
    source: input.source,
    createdAt: new Date().toISOString(),
  };

  profiles[input.externalUserId] = {
    ...base,
    notes: [...(base.notes ?? []), note.content],
  };
  revision += 1;

  return {
    created,
    note,
    profile: cloneProfile(profiles[input.externalUserId]),
  };
}

export function getMockCandidateProfileRevision() {
  return revision;
}

export function resetMockCandidateProfiles() {
  profiles = cloneProfiles(seedProfiles);
  revision += 1;
}

function createUnknownProfile(externalUserId: string): CandidateProfile {
  return {
    externalUserId,
    displayName: "Unknown Zalo Candidate",
    skills: [],
    preferredRoles: [],
    notes: ["No existing CRM profile found; treat this as a new candidate."],
  };
}

function withoutArrayFields(patch: CandidateProfilePatch) {
  const { skills: _skills, preferredRoles: _preferredRoles, ...scalarFields } = patch;
  return scalarFields;
}

function mergeUnique(existing: string[] = [], incoming: string[] = []) {
  return Array.from(new Set([...existing, ...incoming]));
}

function cloneProfiles(input: Record<string, CandidateProfile>) {
  return Object.fromEntries(
    Object.entries(input).map(([externalUserId, profile]) => [externalUserId, cloneProfile(profile)]),
  );
}

function cloneProfile(profile: CandidateProfile): CandidateProfile {
  return {
    ...profile,
    skills: [...profile.skills],
    preferredRoles: [...profile.preferredRoles],
    notes: profile.notes ? [...profile.notes] : undefined,
  };
}
