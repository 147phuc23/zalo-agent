export const CANONICAL_LOCATIONS = ["Ho Chi Minh City", "Ha Noi", "Da Nang", "Remote"] as const;
export type CanonicalLocation = typeof CANONICAL_LOCATIONS[number];

export function normalizeLocation(input: string | null | undefined): string {
  if (!input) return "";
  const normalized = input.toLowerCase().trim();

  if (/hcm|ho chi minh|saigon|sai gon|hồ chí minh/i.test(normalized)) {
    return "Ho Chi Minh City";
  }
  if (/hanoi|ha noi|hà nội|hn/i.test(normalized)) {
    return "Ha Noi";
  }
  if (/da nang|đà nẵng|danang|dn/i.test(normalized)) {
    return "Da Nang";
  }
  if (/remote/i.test(normalized)) {
    return "Remote";
  }
  return input;
}

export interface JobMatchFilters {
  role?: string;
  location?: string;
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
    location: string;
    workMode: "remote" | "hybrid" | "onsite";
    salaryMaxVnd: number;
    requiredSkills: string[];
  },
  filters: JobMatchFilters
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
    const jobTitleLower = job.title.toLowerCase();
    const filterRoleLower = filters.role.toLowerCase();
    if (jobTitleLower.includes(filterRoleLower)) {
      roleScore = 4;
      reasons.push("role exact match");
    } else {
      const words = filterRoleLower.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        const matched = words.filter((w) => jobTitleLower.includes(w));
        if (matched.length > 0) {
          const ratio = matched.length / words.length;
          roleScore = Math.round(ratio * 4);
          reasons.push(`role partial match (${matched.join(", ")})`);
        }
      }
    }
  }

  // 2. Location Match
  if (filters.location) {
    const canonicalFilter = normalizeLocation(filters.location);
    const canonicalJob = normalizeLocation(job.location);
    if (canonicalFilter && canonicalJob && canonicalFilter.toLowerCase() === canonicalJob.toLowerCase()) {
      locationScore = 2;
      reasons.push("location exact match");
    } else if (job.location.toLowerCase().includes(filters.location.toLowerCase())) {
      locationScore = 2;
      reasons.push("location substring match");
    }
  }

  // 3. Work Mode Match
  if (filters.workMode && job.workMode === filters.workMode) {
    workModeScore = 2;
    reasons.push("work mode match");
  }

  // 4. Salary Match
  if (filters.salaryMinVnd) {
    if (job.salaryMaxVnd === 0) {
      salaryScore = 2; // Treat negotiable/unlisted as compatible
      reasons.push("salary is negotiable/unspecified");
    } else if (job.salaryMaxVnd >= filters.salaryMinVnd) {
      salaryScore = 2;
      reasons.push("salary matches expectations");
    }
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
  const hasCoreFilter = filters.role || filters.location || (filters.skills && filters.skills.length > 0);
  const hasCoreMatch = roleScore > 0 || locationScore > 0 || skillsScore > 0;
  if (hasCoreFilter && !hasCoreMatch) {
    return { score: 0, reasons: ["no core filter match (role, location, skills)"] };
  }

  return { score, reasons };
}
