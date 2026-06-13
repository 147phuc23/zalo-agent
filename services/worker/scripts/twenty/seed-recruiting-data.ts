/**
 * Seed deterministic recruiting demo records into Twenty.
 * Creates 6 candidates, 5 job postings, and 10 applications spread across pipeline stages.
 *
 * Prerequisite: `pnpm --filter @platform/worker twenty:schema`
 *
 * Usage:
 *   pnpm --filter @platform/worker twenty:seed
 */
import { loadTwentyEnv } from "../../src/agent/twenty/twenty-env.js";
import { twentyHttpJson } from "../../src/agent/twenty/twenty-http.js";
import {
  extractCoreManyRecords,
  pickFirstRecord,
} from "../../src/agent/twenty/twenty-rest-parsers.js";
import {
  RECRUITING_JOB_APPLICATION_FIELDS,
  RECRUITING_JOB_POSTING_FIELDS,
  RECRUITING_OBJECTS,
  RECRUITING_PERSON_FIELDS,
} from "../../src/agent/twenty/recruiting-schema-constants.js";
import { loadRepoEnvLocal } from "./load-repo-env.js";

// ── Candidate seed data ────────────────────────────────────────────────────────

const CANDIDATES = [
  {
    externalUserId: "zalo-candidate-001",
    firstName: "Minh",
    lastName: "Nguyễn",
    email: "minh.nguyen@example.local",
    phone: "+84901234001",
    currentTitle: "Frontend Engineer",
    currentCompany: "Tiki Corp",
    skillsSummary: "React, TypeScript, Next.js, TailwindCSS, GraphQL",
    preferredRolesSummary: "Frontend Engineer, Full-stack Engineer",
    salaryExpectationVnd: 45_000_000,
    yearsExperience: 3,
    noticePeriodDays: 30,
    recruitingPipelineStage: "SCREENING",
    linkedinUrl: "https://linkedin.com/in/minh-nguyen-demo",
    education: "Bachelor of IT, HCMUS",
    resumeUrl: "https://drive.google.com/file/d/minh-resume/view",
    candidateSource: "Zalo Search",
    hiringRating: 4,
  },
  {
    externalUserId: "zalo-candidate-002",
    firstName: "Linh",
    lastName: "Trần",
    email: "linh.tran@example.local",
    phone: "+84901234002",
    currentTitle: "Senior Backend Engineer",
    currentCompany: "VNG Corporation",
    skillsSummary: "Node.js, NestJS, PostgreSQL, Redis, Kafka, Docker",
    preferredRolesSummary: "Backend Engineer, Tech Lead",
    salaryExpectationVnd: 65_000_000,
    yearsExperience: 6,
    noticePeriodDays: 45,
    recruitingPipelineStage: "INTERVIEWING",
    linkedinUrl: "https://linkedin.com/in/linh-tran-demo",
    education: "Master of CS, HUST",
    resumeUrl: "https://drive.google.com/file/d/linh-resume/view",
    candidateSource: "LinkedIn",
    hiringRating: 5,
  },
  {
    externalUserId: "zalo-candidate-003",
    firstName: "Hùng",
    lastName: "Lê",
    email: "hung.le@example.local",
    phone: "+84901234003",
    currentTitle: "AI/ML Engineer",
    currentCompany: "FPT Software",
    skillsSummary: "Python, PyTorch, LangChain, SQL, FastAPI, LLM fine-tuning",
    preferredRolesSummary: "AI Engineer, ML Engineer, Applied Scientist",
    salaryExpectationVnd: 75_000_000,
    yearsExperience: 5,
    noticePeriodDays: 30,
    recruitingPipelineStage: "NEW",
    linkedinUrl: "https://linkedin.com/in/hung-le-demo",
    education: "Bachelor of Applied Math, HCMUS",
    resumeUrl: "https://drive.google.com/file/d/hung-resume/view",
    candidateSource: "Referral",
    hiringRating: 5,
  },
  {
    externalUserId: "zalo-candidate-004",
    firstName: "Phương",
    lastName: "Phạm",
    email: "phuong.pham@example.local",
    phone: "+84901234004",
    currentTitle: "Product Manager",
    currentCompany: "Grab Vietnam",
    skillsSummary: "Product strategy, User research, SQL, Figma, Agile",
    preferredRolesSummary: "Product Manager, Product Owner",
    salaryExpectationVnd: 55_000_000,
    yearsExperience: 4,
    noticePeriodDays: 60,
    recruitingPipelineStage: "SCREENING",
    linkedinUrl: "https://linkedin.com/in/phuong-pham-demo",
    education: "Bachelor of Business, RMIT",
    resumeUrl: "https://drive.google.com/file/d/phuong-resume/view",
    candidateSource: "VietnamWorks",
    hiringRating: 3,
  },
  {
    externalUserId: "zalo-candidate-005",
    firstName: "Đức",
    lastName: "Vũ",
    email: "duc.vu@example.local",
    phone: "+84901234005",
    currentTitle: "DevOps Engineer",
    currentCompany: "Freelance",
    skillsSummary: "Kubernetes, Terraform, AWS, CI/CD, Prometheus, Grafana",
    preferredRolesSummary: "DevOps Engineer, Platform Engineer, SRE",
    salaryExpectationVnd: 60_000_000,
    yearsExperience: 4,
    noticePeriodDays: 14,
    recruitingPipelineStage: "NEW",
    linkedinUrl: "https://linkedin.com/in/duc-vu-demo",
    education: "Bachelor of EE, HCMUT",
    resumeUrl: "https://drive.google.com/file/d/duc-resume/view",
    candidateSource: "Zalo Ad",
    hiringRating: 4,
  },
  {
    externalUserId: "zalo-candidate-006",
    firstName: "Anh",
    lastName: "Ngô",
    email: "anh.ngo@example.local",
    phone: "+84901234006",
    currentTitle: "Full-stack Engineer",
    currentCompany: "Momo",
    skillsSummary: "React, Node.js, Go, PostgreSQL, Redis, Docker",
    preferredRolesSummary: "Full-stack Engineer, Backend Engineer",
    salaryExpectationVnd: 52_000_000,
    yearsExperience: 4,
    noticePeriodDays: 30,
    recruitingPipelineStage: "PLACED",
    linkedinUrl: "https://linkedin.com/in/anh-ngo-demo",
    education: "Bachelor of SE, FPT University",
    resumeUrl: "https://drive.google.com/file/d/anh-resume/view",
    candidateSource: "Headhunter",
    hiringRating: 4,
  },
] as const;

// ── Job posting seed data ──────────────────────────────────────────────────────

interface JobPosting {
  name: string;
  companyName: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  salaryMinVnd: number;
  salaryMaxVnd: number;
  seniority: string;
  department: string;
  headcount: number;
  status: "OPEN" | "PAUSED" | "CLOSED";
  requiredSkills: string;
  description: string;
  jobType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  experienceRequiredYears: number;
  benefits: string;
  educationRequired: string;
}

const STATIC_JOB_POSTINGS: readonly JobPosting[] = [
  {
    name: "Senior Frontend Engineer",
    companyName: "Atlas Product Studio",
    location: "Ho Chi Minh City",
    workMode: "HYBRID",
    salaryMinVnd: 40_000_000,
    salaryMaxVnd: 60_000_000,
    seniority: "senior",
    department: "Engineering",
    headcount: 2,
    status: "OPEN",
    requiredSkills: "React, TypeScript, Next.js, GraphQL",
    description:
      "Own the frontend of our SaaS platform serving 50k+ SMBs. Work closely with product and design to ship high-quality customer-facing features. Tech: React, TypeScript, Next.js, GraphQL.",
    jobType: "FULL_TIME",
    experienceRequiredYears: 5,
    benefits: "13th month salary, private health insurance, hybrid remote support",
    educationRequired: "Bachelor of IT or equivalent",
  },
  {
    name: "Backend Engineer (NestJS)",
    companyName: "Northstar HR Cloud",
    location: "Ha Noi",
    workMode: "ONSITE",
    salaryMinVnd: 45_000_000,
    salaryMaxVnd: 70_000_000,
    seniority: "mid-senior",
    department: "Engineering",
    headcount: 1,
    status: "OPEN",
    requiredSkills: "Node.js, NestJS, PostgreSQL, Redis",
    description:
      "Build multi-tenant HR SaaS backend: REST + GraphQL APIs, BullMQ job workers, PostgreSQL schema design, and Kafka event streaming.",
    jobType: "FULL_TIME",
    experienceRequiredYears: 3,
    benefits: "MacBook Pro provided, free lunch, yearly company trip",
    educationRequired: "Bachelor of Computer Science",
  },
  {
    name: "AI/ML Engineer",
    companyName: "Signal Recruit",
    location: "Ho Chi Minh City",
    workMode: "REMOTE",
    salaryMinVnd: 60_000_000,
    salaryMaxVnd: 90_000_000,
    seniority: "mid-senior",
    department: "AI & Data",
    headcount: 2,
    status: "OPEN",
    requiredSkills: "Python, LLM, PyTorch, SQL, FastAPI",
    description:
      "Design and evaluate AI recruiter pipelines: RAG for job matching, LLM-based screening workflows, and feedback loop tooling. Python-first stack with FastAPI services.",
    jobType: "FULL_TIME",
    experienceRequiredYears: 4,
    benefits: "High-end GPU workstation, flexible hours, publication bonus",
    educationRequired: "Master or PhD in AI/ML or Math",
  },
  {
    name: "Product Manager — Fintech",
    companyName: "Kredivo Vietnam",
    location: "Ho Chi Minh City",
    workMode: "HYBRID",
    salaryMinVnd: 50_000_000,
    salaryMaxVnd: 75_000_000,
    seniority: "mid",
    department: "Product",
    headcount: 1,
    status: "OPEN",
    requiredSkills: "Product strategy, SQL, Fintech, Agile, User research",
    description:
      "Drive roadmap for our buy-now-pay-later core product. Own discovery, prioritization, and cross-functional delivery with eng and data science.",
    jobType: "FULL_TIME",
    experienceRequiredYears: 3,
    benefits: "Grab transport allowance, gym membership, English classes",
    educationRequired: "Bachelor of Business, Economics or CS",
  },
  {
    name: "Platform / DevOps Engineer",
    companyName: "Coin68 Labs",
    location: "Remote",
    workMode: "REMOTE",
    salaryMinVnd: 55_000_000,
    salaryMaxVnd: 80_000_000,
    seniority: "mid-senior",
    department: "Infrastructure",
    headcount: 1,
    status: "OPEN",
    requiredSkills: "Kubernetes, Terraform, AWS, CI/CD, Prometheus",
    description:
      "Own infrastructure for a crypto data platform on AWS/EKS. Build GitOps pipelines, observability stacks, and cost-optimization tooling.",
    jobType: "CONTRACT",
    experienceRequiredYears: 4,
    benefits: "100% remote, USD billing support, flexible holidays",
    educationRequired: "Any technical degree or solid experience",
  },
];

function generateAdditionalJobs(count: number): JobPosting[] {
  const roles = [
    { name: "Backend AI Engineer", skills: "Python, FastAPI, LLMs, LangChain, PostgreSQL", dept: "AI & Data", focus: ["LLM Agents", "RAG Systems", "Vector Databases", "Prompt Engineering"] },
    { name: "GenAI Developer", skills: "Python, OpenAI API, LangGraph, React, Node.js", dept: "Engineering", focus: ["AI Workflows", "Chatbot Dev", "Agentic Systems", "Fine-tuning"] },
    { name: "AI Tech Lead", skills: "Python, PyTorch, Kubernetes, MLOps, System Design", dept: "AI & Data", focus: ["Model Deployment", "Scalable AI Architecture", "Team Leadership", "Infrastructure"] },
    { name: "Machine Learning Engineer", skills: "Python, TensorFlow, PyTorch, Docker, AWS", dept: "AI & Data", focus: ["Recommendation Engines", "Predictive Analytics", "Deep Learning", "Feature Stores"] },
    { name: "Python Backend Developer", skills: "Python, Django, FastAPI, Redis, PostgreSQL", dept: "Engineering", focus: ["Microservices", "API Gateways", "Event-Driven Dev", "Caching"] },
    { name: "Golang Backend Engineer", skills: "Go, gRPC, PostgreSQL, Kafka, Kubernetes", dept: "Engineering", focus: ["High-Concurrency APIs", "Distributed Systems", "Core Services", "Real-time Messaging"] },
    { name: "Node.js Backend Developer", skills: "Node.js, TypeScript, NestJS, MongoDB, BullMQ", dept: "Engineering", focus: ["Real-time Sockets", "Asynchronous Workers", "Admin Portals", "RESTful APIs"] },
    { name: "Java Technical Lead", skills: "Java, Spring Boot, Microservices, Oracle, Kafka", dept: "Engineering", focus: ["Legacy Migration", "Enterprise Security", "Team Management", "Cloud Deployment"] },
    { name: "Principal Software Architect", skills: "System Design, Cloud Native, Go, Python, AWS", dept: "Engineering", focus: ["High-Availability Systems", "Microservices Design", "Technology Stack Selection", "Performance Optimizations"] },
    { name: "Senior Frontend Developer", skills: "React, TypeScript, Next.js, Redux, TailwindCSS", dept: "Engineering", focus: ["Design System", "State Management", "Performance Optimization", "SEO Best Practices"] },
    { name: "Fullstack AI Developer", skills: "React, Node.js, Python, OpenAI, LangChain", dept: "Engineering", focus: ["AI UI/UX", "Fullstack Platforms", "Serverless Functions", "Integrations"] },
    { name: "Mobile Engineer (React Native)", skills: "React Native, TypeScript, iOS, Android, Redux", dept: "Engineering", focus: ["Cross-platform Apps", "App Store Publishing", "Push Notifications", "Performance Triage"] },
    { name: "QA Automation Lead", skills: "Selenium, Playwright, TypeScript, CI/CD, Jest", dept: "Quality Assurance", focus: ["E2E Test Frameworks", "CI/CD Integration", "Performance Testing", "Bug Reporting"] },
    { name: "Senior DevOps Engineer", skills: "Kubernetes, Terraform, AWS, Jenkins, Prometheus", dept: "Engineering", focus: ["Infrastructure as Code", "GitOps Pipelines", "Observability Stacks", "Cost Control"] },
    { name: "Data Pipeline Engineer", skills: "Python, Apache Spark, Airflow, Snowflake, Kafka", dept: "Data Platform", focus: ["ETL Workflows", "Data Warehousing", "Event Ingestion", "Query Performance"] }
  ];

  const companies = [
    "VNG Corporation", "FPT Software", "Tiki Corp", "Momo", "Viettel Group",
    "VinGroup", "NAB Innovation Centre", "KMS Technology", "NashTech", "OneMount Group",
    "Sentifi", "Axon Active", "Loka", "Base.vn", "AhaMove",
    "Be Group", "Giao Hang Nhanh", "ZaloPay", "Shopee Vietnam", "Grab Vietnam",
    "SmartOSC", "Sotatek", "Rikkeisoft", "Sun* Inc"
  ];

  const locations = ["Ha Noi", "Ho Chi Minh City", "Da Nang"];
  const seniorityList = ["junior", "mid", "senior", "lead", "principal"];
  const workModes: Array<"REMOTE" | "HYBRID" | "ONSITE"> = ["HYBRID", "ONSITE", "REMOTE"];
  const jobTypes: Array<"FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP"> = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"];

  const list: JobPosting[] = [];

  for (let i = 0; i < count; i++) {
    const role = roles[i % roles.length];
    const company = companies[Math.floor(i / locations.length) % companies.length];
    const location = locations[i % locations.length];
    const seniority = seniorityList[Math.floor(i / 3) % seniorityList.length];
    const workMode = workModes[i % workModes.length];
    const jobType = jobTypes[i % jobTypes.length];
    
    // Choose a unique focus to avoid name collision
    const focus = role.focus[i % role.focus.length];
    const capitalizedSeniority = seniority.charAt(0).toUpperCase() + seniority.slice(1);
    
    // Unique name structure: e.g. "Senior Backend AI Engineer (LLM Agents) - FPT Software"
    const name = `${capitalizedSeniority} ${role.name} (${focus}) - ${company}`;

    const salaryMinVnd = 20_000_000 + (seniorityList.indexOf(seniority) * 10_000_000) + ((i % 5) * 2_000_000);
    const salaryMaxVnd = salaryMinVnd + 15_000_000 + ((i % 3) * 5_000_000);
    const headcount = (i % 3) + 1;
    const experienceRequiredYears = Math.max(1, seniorityList.indexOf(seniority) * 2 + (i % 2));

    const benefits = i % 2 === 0
      ? "13th month salary, private health insurance, laptop provided, flexible hours"
      : "Quarterly bonuses, remote allowance, training sponsorship, premium healthcare package";
      
    const educationRequired = seniority === "principal" || seniority === "lead"
      ? "Master of Computer Science or related degree"
      : "Bachelor of IT or equivalent experience";

    list.push({
      name,
      companyName: company,
      location,
      workMode,
      salaryMinVnd,
      salaryMaxVnd,
      seniority,
      department: role.dept,
      headcount,
      status: "OPEN",
      requiredSkills: role.skills,
      description: `Join us at ${company} to build the future of our tech stack! As a ${capitalizedSeniority} ${role.name}, you will own the design and development of our ${focus} systems. Requirements: proficiency in ${role.skills}.`,
      jobType,
      experienceRequiredYears,
      benefits,
      educationRequired
    });
  }

  return list;
}

const JOB_POSTINGS: readonly JobPosting[] = [
  ...STATIC_JOB_POSTINGS,
  ...generateAdditionalJobs(95),
];

// ── Application links [candidateIndex, jobIndex, stage, matchScore] ───────────

const APPLICATIONS: Array<{
  candidateExternalId: string;
  jobName: string;
  pipelineStage: string;
  matchScore: number;
}> = [
  // Minh (Frontend) → Frontend Engineer role (great match)
  { candidateExternalId: "zalo-candidate-001", jobName: "Senior Frontend Engineer", pipelineStage: "SCREENING", matchScore: 88 },
  // Minh also applied to Backend (weaker match)
  { candidateExternalId: "zalo-candidate-001", jobName: "Backend Engineer (NestJS)", pipelineStage: "APPLIED", matchScore: 52 },
  // Linh (Backend) → Backend Engineer (strong match, in interview)
  { candidateExternalId: "zalo-candidate-002", jobName: "Backend Engineer (NestJS)", pipelineStage: "INTERVIEW", matchScore: 91 },
  // Linh also applied to Frontend (lower match)
  { candidateExternalId: "zalo-candidate-002", jobName: "Senior Frontend Engineer", pipelineStage: "APPLIED", matchScore: 58 },
  // Hùng (AI) → AI Engineer (strong match)
  { candidateExternalId: "zalo-candidate-003", jobName: "AI/ML Engineer", pipelineStage: "SCREENING", matchScore: 93 },
  // Phương (PM) → PM Fintech (strong match)
  { candidateExternalId: "zalo-candidate-004", jobName: "Product Manager — Fintech", pipelineStage: "INTERVIEW", matchScore: 85 },
  // Đức (DevOps) → Platform Engineer (strong match)
  { candidateExternalId: "zalo-candidate-005", jobName: "Platform / DevOps Engineer", pipelineStage: "SCREENING", matchScore: 90 },
  // Đức also applied to Backend (weaker)
  { candidateExternalId: "zalo-candidate-005", jobName: "Backend Engineer (NestJS)", pipelineStage: "APPLIED", matchScore: 45 },
  // Anh (Fullstack) → Frontend (good match)
  { candidateExternalId: "zalo-candidate-006", jobName: "Senior Frontend Engineer", pipelineStage: "OFFER", matchScore: 79 },
  // Anh → Backend (good match too)
  { candidateExternalId: "zalo-candidate-006", jobName: "Backend Engineer (NestJS)", pipelineStage: "REJECTED", matchScore: 71 },
];

// ── Main ───────────────────────────────────────────────────────────────────────

export async function seedRecruitingDemoData() {
  const env = loadTwentyEnv();
  const baseUrl = env.TWENTY_BASE_URL;
  const apiKey = env.TWENTY_API_KEY;

  // ── People ──────────────────────────────────────────────────────────────────
  console.log("[twenty:seed] Seeding candidates…");

  for (const candidate of CANDIDATES) {
    const existing = await findPersonByExternalId(baseUrl, apiKey, candidate.externalUserId);
    if (existing?.id) {
      console.log(`[twenty:seed] Candidate exists: ${candidate.firstName} ${candidate.lastName}. Updating new fields…`);
      await twentyHttpJson({
        baseUrl,
        apiKey,
        request: {
          path: `/rest/people/${String(existing.id)}`,
          method: "PATCH",
          body: {
            [RECRUITING_PERSON_FIELDS.education]: candidate.education,
            [RECRUITING_PERSON_FIELDS.resumeUrl]: candidate.resumeUrl,
            [RECRUITING_PERSON_FIELDS.candidateSource]: candidate.candidateSource,
            [RECRUITING_PERSON_FIELDS.hiringRating]: candidate.hiringRating,
          },
        },
      });
      continue;
    }

    await twentyHttpJson({
      baseUrl,
      apiKey,
      request: {
        path: "/rest/people",
        method: "POST",
        body: {
          name: { firstName: candidate.firstName, lastName: candidate.lastName },
          emails: { primaryEmail: candidate.email, additionalEmails: [] },
          phones: { primaryPhoneNumber: candidate.phone, primaryPhoneCountryCode: "VN", additionalPhones: [] },
          [RECRUITING_PERSON_FIELDS.externalUserId]: candidate.externalUserId,
          [RECRUITING_PERSON_FIELDS.recruitingPipelineStage]: candidate.recruitingPipelineStage,
          [RECRUITING_PERSON_FIELDS.skillsSummary]: candidate.skillsSummary,
          [RECRUITING_PERSON_FIELDS.preferredRolesSummary]: candidate.preferredRolesSummary,
          [RECRUITING_PERSON_FIELDS.salaryExpectationVnd]: candidate.salaryExpectationVnd,
          [RECRUITING_PERSON_FIELDS.yearsExperience]: candidate.yearsExperience,
          [RECRUITING_PERSON_FIELDS.currentTitle]: candidate.currentTitle,
          [RECRUITING_PERSON_FIELDS.currentCompany]: candidate.currentCompany,
          [RECRUITING_PERSON_FIELDS.noticePeriodDays]: candidate.noticePeriodDays,
          [RECRUITING_PERSON_FIELDS.linkedinUrl]: candidate.linkedinUrl,
          [RECRUITING_PERSON_FIELDS.education]: candidate.education,
          [RECRUITING_PERSON_FIELDS.resumeUrl]: candidate.resumeUrl,
          [RECRUITING_PERSON_FIELDS.candidateSource]: candidate.candidateSource,
          [RECRUITING_PERSON_FIELDS.hiringRating]: candidate.hiringRating,
        },
      },
    });

    console.log(`[twenty:seed] Created candidate: ${candidate.firstName} ${candidate.lastName}`);
  }

  // ── Job postings ─────────────────────────────────────────────────────────────
  console.log("[twenty:seed] Seeding job postings…");

  const jobIds: Record<string, string> = {};

  for (const job of JOB_POSTINGS) {
    const existing = await findJobPostingByName(baseUrl, apiKey, job.name);
    if (existing?.id) {
      jobIds[job.name] = String(existing.id);
      console.log(`[twenty:seed] Job posting exists: ${job.name}. Updating new fields…`);
      await twentyHttpJson({
        baseUrl,
        apiKey,
        request: {
          path: `/rest/${RECRUITING_OBJECTS.jobPosting.namePlural}/${String(existing.id)}`,
          method: "PATCH",
          body: {
            [RECRUITING_JOB_POSTING_FIELDS.jobType]: job.jobType,
            [RECRUITING_JOB_POSTING_FIELDS.experienceRequiredYears]: job.experienceRequiredYears,
            [RECRUITING_JOB_POSTING_FIELDS.benefits]: job.benefits,
            [RECRUITING_JOB_POSTING_FIELDS.educationRequired]: job.educationRequired,
          },
        },
      });
      continue;
    }

    const created = await twentyHttpJson<unknown>({
      baseUrl,
      apiKey,
      request: {
        path: `/rest/${RECRUITING_OBJECTS.jobPosting.namePlural}`,
        method: "POST",
        body: {
          name: job.name,
          [RECRUITING_JOB_POSTING_FIELDS.companyName]: job.companyName,
          [RECRUITING_JOB_POSTING_FIELDS.location]: job.location,
          [RECRUITING_JOB_POSTING_FIELDS.workMode]: job.workMode,
          [RECRUITING_JOB_POSTING_FIELDS.salaryMinVnd]: job.salaryMinVnd,
          [RECRUITING_JOB_POSTING_FIELDS.salaryMaxVnd]: job.salaryMaxVnd,
          [RECRUITING_JOB_POSTING_FIELDS.seniority]: job.seniority,
          [RECRUITING_JOB_POSTING_FIELDS.department]: job.department,
          [RECRUITING_JOB_POSTING_FIELDS.headcount]: job.headcount,
          [RECRUITING_JOB_POSTING_FIELDS.status]: job.status,
          [RECRUITING_JOB_POSTING_FIELDS.requiredSkills]: job.requiredSkills,
          [RECRUITING_JOB_POSTING_FIELDS.description]: job.description,
          [RECRUITING_JOB_POSTING_FIELDS.jobType]: job.jobType,
          [RECRUITING_JOB_POSTING_FIELDS.experienceRequiredYears]: job.experienceRequiredYears,
          [RECRUITING_JOB_POSTING_FIELDS.benefits]: job.benefits,
          [RECRUITING_JOB_POSTING_FIELDS.educationRequired]: job.educationRequired,
        },
      },
    });

    const row = extractSingularRecord(created);
    const id = row?.id ? String(row.id) : "";
    if (!id) throw new Error(`[twenty:seed] Unexpected jobPosting response: ${JSON.stringify(created)}`);

    jobIds[job.name] = id;
    console.log(`[twenty:seed] Created job posting: ${job.name} (${id})`);
  }

  // ── Applications ─────────────────────────────────────────────────────────────
  console.log("[twenty:seed] Seeding applications…");

  for (const app of APPLICATIONS) {
    const jobPostingRecordId = jobIds[app.jobName];
    if (!jobPostingRecordId) {
      console.warn(`[twenty:seed] Job id not found for "${app.jobName}", skipping application.`);
      continue;
    }

    const existing = await findApplication(baseUrl, apiKey, {
      candidateExternalId: app.candidateExternalId,
      jobPostingRecordId,
    });

    if (existing) {
      console.log(`[twenty:seed] Application exists: ${app.candidateExternalId} → ${app.jobName}`);
      continue;
    }

    await twentyHttpJson({
      baseUrl,
      apiKey,
      request: {
        path: `/rest/${RECRUITING_OBJECTS.jobApplication.namePlural}`,
        method: "POST",
        body: {
          [RECRUITING_JOB_APPLICATION_FIELDS.candidateExternalId]: app.candidateExternalId,
          [RECRUITING_JOB_APPLICATION_FIELDS.jobPostingRecordId]: jobPostingRecordId,
          [RECRUITING_JOB_APPLICATION_FIELDS.pipelineStage]: app.pipelineStage,
          [RECRUITING_JOB_APPLICATION_FIELDS.matchScore]: app.matchScore,
        },
      },
    });

    console.log(`[twenty:seed] Created application: ${app.candidateExternalId} → ${app.jobName} (${app.pipelineStage}, score: ${app.matchScore})`);
  }

  console.log("[twenty:seed] Done.");
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function findPersonByExternalId(baseUrl: string, apiKey: string, externalUserId: string) {
  const payload = await twentyHttpJson<unknown>({
    baseUrl,
    apiKey,
    request: {
      path: "/rest/people",
      method: "GET",
      query: {
        filter: `${RECRUITING_PERSON_FIELDS.externalUserId}[eq]:${externalUserId}`,
        limit: "5",
      },
    },
  });
  return pickFirstRecord(payload);
}

async function findJobPostingByName(baseUrl: string, apiKey: string, name: string) {
  const payload = await twentyHttpJson<unknown>({
    baseUrl,
    apiKey,
    request: {
      path: `/rest/${RECRUITING_OBJECTS.jobPosting.namePlural}`,
      method: "GET",
      query: { filter: `name[eq]:${name}`, limit: "5" },
    },
  });
  return pickFirstRecord(payload);
}

async function findApplication(
  baseUrl: string,
  apiKey: string,
  input: { candidateExternalId: string; jobPostingRecordId: string },
) {
  const payload = await twentyHttpJson<unknown>({
    baseUrl,
    apiKey,
    request: {
      path: `/rest/${RECRUITING_OBJECTS.jobApplication.namePlural}`,
      method: "GET",
      query: {
        filter: `and(${RECRUITING_JOB_APPLICATION_FIELDS.candidateExternalId}[eq]:${input.candidateExternalId},${RECRUITING_JOB_APPLICATION_FIELDS.jobPostingRecordId}[eq]:${input.jobPostingRecordId})`,
        limit: "5",
      },
    },
  });
  const rows = extractCoreManyRecords(payload);
  const first = rows[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

function extractSingularRecord(payload: unknown): Record<string, unknown> | null {
  const data = (payload as { data?: Record<string, unknown> }).data;
  if (!data || typeof data !== "object") return null;
  for (const value of Object.values(data)) {
    if (!value || Array.isArray(value)) continue;
    if (typeof value === "object") return value as Record<string, unknown>;
  }
  return null;
}

loadRepoEnvLocal();

seedRecruitingDemoData().catch((error) => {
  console.error("[twenty:seed] Failed:", error);
  process.exitCode = 1;
});
