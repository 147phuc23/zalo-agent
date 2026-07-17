-- Migration 17: Add interview_process column to companies and seed default rounds
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS interview_process jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Seed Atlas Product Studio
UPDATE public.companies 
SET interview_process = '[
  {"round": 1, "name": "Resume Screening", "description": "HR reviews the candidate''s resume, technical skills, and past experience."},
  {"round": 2, "name": "Technical Assessment", "description": "A take-home coding assignment or online live coding session covering core programming paradigms."},
  {"round": 3, "name": "Technical Panel", "description": "A deep-dive technical interview with Atlas senior engineers covering system design and architecture."},
  {"round": 4, "name": "Culture Fit & Offer", "description": "Final conversation with our leadership team about alignment, expectations, and compensation."}
]'::jsonb
WHERE name = 'Atlas Product Studio';

-- Seed Thoughtworks
UPDATE public.companies 
SET interview_process = '[
  {"round": 1, "name": "Initial Screening", "description": "A short call with recruiters to align on experience, salary expectations, and role match."},
  {"round": 2, "name": "Technical Pair Programming", "description": "Live 90-minute pairing session with a senior developer to solve a realistic software problem."},
  {"round": 3, "name": "Technical Deep Dive", "description": "Discussion about your project history, system design, and technology choices."},
  {"round": 4, "name": "Social & Cultural Alignment", "description": "An interactive round discussing Agile values, collaboration styles, and consulting skills."}
]'::jsonb
WHERE name = 'Thoughtworks';

-- Seed FPT Software
UPDATE public.companies 
SET interview_process = '[
  {"round": 1, "name": "CV Review", "description": "HR team reviews your application against the job requirements."},
  {"round": 2, "name": "Technical Interview", "description": "Interview with a Technical Lead focused on programming languages, frameworks, and database skills."},
  {"round": 3, "name": "Customer / Project Interview", "description": "Technical interview directly with FPT''s client or project stakeholder."},
  {"round": 4, "name": "HR Interview & Offer", "description": "Final negotiation regarding benefits, salary, onboarding date, and contract terms."}
]'::jsonb
WHERE name = 'FPT Software';

-- Seed fallback for any other company
UPDATE public.companies 
SET interview_process = '[
  {"round": 1, "name": "Application Screening", "description": "Initial resume and profile validation by recruitment team."},
  {"round": 2, "name": "Technical Interview", "description": "Assessing core engineering capabilities, problem solving, and framework experience."},
  {"round": 3, "name": "Final Interview & Offer", "description": "Aligning on career goals, team fit, and compensation structure."}
]'::jsonb
WHERE interview_process = '[]'::jsonb;
