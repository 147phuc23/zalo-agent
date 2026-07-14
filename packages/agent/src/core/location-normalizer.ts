import { CANONICAL_LOCATIONS, type CanonicalLocation } from "@platform/shared/locations";

export { CANONICAL_LOCATIONS, type CanonicalLocation };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Plain `\b` only recognizes ASCII word characters, so it fails to anchor next to
// Vietnamese diacritics (e.g. "Đ", "ẵ") — use Unicode-aware letter/number boundaries instead.
const LOCATION_PATTERNS: Array<{ slug: string; pattern: RegExp }> =
  CANONICAL_LOCATIONS.map((loc) => {
    const alternatives = [loc.englishName, loc.vietnameseName, ...loc.aliases].map(
      escapeRegex,
    );
    return {
      slug: loc.slug,
      pattern: new RegExp(
        `(?<![\\p{L}\\p{N}])(${alternatives.join("|")})(?![\\p{L}\\p{N}])`,
        "iu",
      ),
    };
  });

function findCanonicalLocation(slug: string): CanonicalLocation | undefined {
  return CANONICAL_LOCATIONS.find((loc) => loc.slug === slug);
}

export function slugToDisplayName(slug: string): string {
  return findCanonicalLocation(slug)?.englishName ?? slug;
}

/** Best single canonical slug match in free text, or undefined if none of the known cities are mentioned. */
export function normalizeLocationToSlug(
  input: string | null | undefined,
): string | undefined {
  if (!input) return undefined;
  for (const { slug, pattern } of LOCATION_PATTERNS) {
    if (pattern.test(input)) return slug;
  }
  return undefined;
}

/** Every canonical slug mentioned in free text (deduplicated), for candidates/jobs that span multiple cities. */
export function extractLocationSlugs(text: string | null | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const { slug, pattern } of LOCATION_PATTERNS) {
    if (pattern.test(text)) found.push(slug);
  }
  return found;
}

/**
 * Legacy single-value normalizer kept for Twenty's single-text Person.city field:
 * returns the canonical display name if recognized, otherwise the original input untouched.
 */
export function normalizeLocation(input: string | null | undefined): string {
  if (!input) return "";
  const slug = normalizeLocationToSlug(input);
  return slug ? slugToDisplayName(slug) : input;
}

/**
 * Shared by scoreJob (filter-based search) and scoreJobAgainstProfile (profile-based
 * recommendations) so the two matching paths can't silently diverge. A partial match
 * requires every word in filterRole to appear in the title — not just some of them —
 * so "Frontend Engineer" doesn't match "Backend Engineer" on the shared word "engineer".
 */
export function scoreRoleMatch(
  filterRole: string,
  jobTitle: string,
): { score: number; reason: string } | null {
  const jobTitleLower = jobTitle.toLowerCase();
  const filterRoleLower = filterRole.toLowerCase();
  if (!filterRoleLower) return null;
  if (jobTitleLower.includes(filterRoleLower)) {
    return { score: 4, reason: `role "${filterRole}" exact match aligns with title` };
  }
  const words = filterRoleLower.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every((w) => jobTitleLower.includes(w))) {
    return {
      score: 4,
      reason: `role "${filterRole}" partial match aligns with title (${words.join(", ")})`,
    };
  }
  return null;
}

/** Shared salary-fit check: negotiable/unspecified job salaries are treated as compatible. */
export function scoreSalaryMatch(
  expectationVnd: number | undefined,
  jobSalaryMaxVnd: number,
): { score: number; reason: string } | null {
  if (!expectationVnd) return null;
  if (jobSalaryMaxVnd === 0)
    return { score: 1, reason: "salary is negotiable/unspecified" };
  if (jobSalaryMaxVnd >= expectationVnd)
    return { score: 1, reason: "salary band covers expectation" };
  return null;
}

export interface JobMatchFilters {
  role?: string;
  /** Free text (e.g. from a tool call); normalized to canonical slugs internally. */
  locations?: string[];
  workMode?: "remote" | "hybrid" | "onsite";
  salaryMinVnd?: number;
  skills?: string[];
}

export interface ScoredJobResult {
  score: number;
  reasons: string[];
}

export function scoreJob(
  job: {
    title: string;
    locationSlugs: string[];
    workMode: "remote" | "hybrid" | "onsite";
    salaryMaxVnd: number;
    requiredSkills: string[];
  },
  filters: JobMatchFilters,
): ScoredJobResult {
  let score = 0;
  const reasons: string[] = [];

  let roleScore = 0;
  let locationScore = 0;
  let workModeScore = 0;
  let salaryScore = 0;
  let skillsScore = 0;

  // 1. Role Match
  if (filters.role) {
    const roleMatch = scoreRoleMatch(filters.role, job.title);
    if (roleMatch) {
      roleScore = roleMatch.score;
      reasons.push(roleMatch.reason);
    }
  }

  // 2. Location Match — canonical slug overlap
  if (filters.locations && filters.locations.length > 0) {
    const filterSlugs = new Set(
      filters.locations.flatMap((loc) => extractLocationSlugs(loc)),
    );
    const slugOverlap =
      filterSlugs.size > 0 && job.locationSlugs.some((slug) => filterSlugs.has(slug));
    if (slugOverlap) {
      locationScore = 2;
      reasons.push("location match");
    }
  }

  // 3. Work Mode Match
  if (filters.workMode && job.workMode === filters.workMode) {
    workModeScore = 2;
    reasons.push("work mode match");
  }

  // 4. Salary Match
  const salaryMatch = scoreSalaryMatch(filters.salaryMinVnd, job.salaryMaxVnd);
  if (salaryMatch) {
    salaryScore = salaryMatch.score * 2; // filter-based search weighs salary fit at 2, not 1
    reasons.push(salaryMatch.reason);
  }

  // 5. Skills Match
  if (filters.skills && filters.skills.length > 0) {
    const filterSkills = new Set(filters.skills.map((s) => s.toLowerCase()));
    for (const skill of job.requiredSkills) {
      if (filterSkills.has(skill.toLowerCase())) {
        skillsScore += 1;
        reasons.push(`skill match: ${skill}`);
      }
    }
  }

  score = roleScore + locationScore + workModeScore + salaryScore + skillsScore;

  // Safeguard: If core filters (role, location, skills) are specified but none matched,
  // do not return a match purely on salary or workMode.
  const hasCoreFilter =
    filters.role ||
    (filters.locations && filters.locations.length > 0) ||
    (filters.skills && filters.skills.length > 0);
  const hasCoreMatch = roleScore > 0 || locationScore > 0 || skillsScore > 0;
  if (hasCoreFilter && !hasCoreMatch) {
    return { score: 0, reasons: ["no core filter match (role, location, skills)"] };
  }

  return { score, reasons };
}
