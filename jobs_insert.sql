-- Migration/Seed to insert parsed job postings from jobs/ folder
-- Target Tenant: b545a6ca-eabe-4bb8-852d-2c497edb8e38

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Application or Systems Support Engineer_Thoughtworks',
  'Application / Systems Support Engineer',
  'Thoughtworks',
  'Ho Chi Minh City',
  'onsite',
  0,
  0,
  'mid',
  '{"Java","AWS","Azure","GCP","Python","PowerShell","Relational Databases","Non-relational Databases","Jenkins","Azure Pipelines","DataDog","Prometheus","Grafana","Scrum","Kanban"}',
  'Support day-to-day operations of application systems, manage incidents, debug business-impacting issues, implement monitoring and alerting, and use continuous delivery practices to ensure system stability and availability.',
  'FULL_TIME',
  NULL,
  'Learning and development programs, career growth support, inclusive and supportive community culture.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Fullstack Software Engineer (Javascript, JavaorKotlin)_Thoughtworks',
  'Fullstack Software Engineer (Javascript, Java/Kotlin)',
  'Thoughtworks',
  'Ho Chi Minh City',
  'onsite',
  0,
  0,
  'mid',
  '{"JavaScript","Node.js","React"}',
  'Collaborate with cross-functional teams to design and build high-quality software solutions using clean code, TDD, continuous delivery, and DevOps practices for clients.',
  'FULL_TIME',
  3,
  'Learning and development programs, career growth support, health and wellbeing benefits, inclusive workplace.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Fullstack Software Engineer (Node.js, React)_Thoughtworks',
  'Fullstack Software Engineer (Node.js, React)',
  'Thoughtworks',
  'Ho Chi Minh City',
  'onsite',
  0,
  0,
  'mid',
  '{"Node.js","React","TDD","Continuous Delivery","Agile","Continuous Integration"}',
  'Collaborate with cross-functional teams to design and build high-quality software solutions using Node.js and React, adopting best practices like TDD, continuous delivery, and clean code to deliver innovative client experiences.',
  'FULL_TIME',
  3,
  'Interactive learning tools, development programs, career growth support, inclusive community.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Lead Software Engineer (Java)_Thoughtworks',
  'Lead Software Engineer (Java)',
  'Thoughtworks',
  'Ho Chi Minh City',
  'onsite',
  0,
  0,
  'lead',
  '{"Java","JavaScript","TypeScript","React.js"}',
  'Lead client software delivery, champion best practices (TDD, clean code), design solutions, mentor teams, and advocate DevSecOps culture.',
  'FULL_TIME',
  NULL,
  'Learning and development programs, career growth support, inclusive and supportive team culture.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Lead Systems Support Engineer_Thoughtworks',
  'Lead Systems Support Engineer',
  'Thoughtworks',
  'Ho Chi Minh City, Vietnam',
  'onsite',
  0,
  0,
  'lead',
  '{"Java",".NET","Python","PowerShell","AWS","Azure","GCP","Datadog","Prometheus","Grafana","Jenkins","GitHub Actions","Buildkite","Azure Pipelines","Relational Database","Non-relational Database","CI/CD","Microservices","Serverless"}',
  'Lead a team to ensure operational efficiency, stability and availability of complex application systems; handle incident management, DevOps, system upgrades, mentoring, and client-facing problem-solving.',
  'FULL_TIME',
  NULL,
  'Learning and development programs, career growth support, inclusive community, autonomous career path.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Senior Application or Systems Support Engineer_Thoughtworks',
  'Senior Application / Systems Support Engineer',
  'Thoughtworks',
  'Ho Chi Minh City',
  'onsite',
  0,
  0,
  'senior',
  '{"C#",".NET","AWS","Azure","GCP","Python","PowerShell","MS SQL","MySQL","PostgreSQL","Docker","Jenkins","Azure Pipelines","DataDog","Prometheus","Grafana","Scrum","Kanban"}',
  'Ensure operational efficiency, stability and availability of complex application systems via incident management, application monitoring, debugging, continuous delivery and DevOps practices; mentor less experienced peers.',
  'FULL_TIME',
  NULL,
  'Learning and development programs, career growth support, inclusive and supportive community.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Senior Fullstack Software Engineer (Node.js, React)_Thoughtworks',
  'Senior Fullstack Software Engineer (Node.js, React)',
  'Thoughtworks',
  'Ho Chi Minh City',
  'onsite',
  0,
  0,
  'senior',
  '{"Node.js","React","Object-Oriented Programming","Agile","TDD","CI/CD"}',
  'Collaborate with cross-functional teams to design and deliver software solutions using Node.js and React, build microservices, advocate best engineering practices like TDD and continuous delivery, utilize DevSecOps, and mentor junior developers.',
  'FULL_TIME',
  NULL,
  'Learning and development programs, career growth support, inclusive and supportive community culture.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Senior Fullstack Software Engineer (Node.js, React, Java)_Thoughtworks',
  'Senior Fullstack Software Engineer (Node.js, React, Java)',
  'Thoughtworks',
  'Ho Chi Minh City',
  'onsite',
  0,
  0,
  'senior',
  '{"Node.js","React","Java"}',
  'Collaborate with cross-functional teams to design and deliver clean, tested software solutions using Node.js, React, and Java; build microservices-based distributed systems; mentor junior developers; advocate for best engineering practices and continuous delivery.',
  'FULL_TIME',
  NULL,
  'Learning and development programs, career autonomy, supportive cultivation culture, inclusive community of experts.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Senior Software Engineer (C#or.Net)_Thoughtworks',
  'Senior Software Engineer (C#/.Net)',
  'Thoughtworks',
  'Ho Chi Minh City, Vietnam',
  'onsite',
  0,
  0,
  'senior',
  '{"C#",".NET","Object-Oriented Programming","TDD","Continuous Integration","Continuous Delivery","Agile Methodologies","Microservices","DevSecOps"}',
  'Collaborate with cross-functional teams to design and deliver software solutions using C#/.Net, microservices, and AI-first practices; mentor junior developers; ensure code quality and adopt best engineering practices.',
  'FULL_TIME',
  NULL,
  'Learning & development programs, career growth autonomy, inclusive community, mentorship.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Senior Software Engineer (Java)_Thoughtworks',
  'Senior Software Engineer (Java)',
  'Thoughtworks',
  'Ho Chi Minh City, Vietnam',
  'onsite',
  0,
  0,
  'senior',
  '{"Java","Object-Oriented Programming","TDD","Continuous Integration","Continuous Delivery","Agile Methodologies","Microservices","DevSecOps"}',
  'Collaborate with cross-functional teams to design and deliver high-quality software solutions using Java and microservices, advocate for best engineering practices, drive AI-first delivery, and mentor junior developers.',
  'FULL_TIME',
  NULL,
  'Interactive tools, numerous development programs, and supportive teammates for career growth in an inclusive culture.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Senior Software Engineer (Javascript, Java)_Thoughtworks',
  'Senior Software Engineer (Javascript, Java)',
  'Thoughtworks',
  'Ho Chi Minh City, Vietnam',
  'onsite',
  0,
  0,
  'senior',
  '{"JavaScript","Node.js","React","Java"}',
  'Collaborate with cross-functional teams to design and deliver software solutions, write clean and iterative code, mentor junior developers, build large-scale distributed systems from microservices, and advocate for engineering best practices.',
  'FULL_TIME',
  NULL,
  'Autonomous career development, learning and development programs, supportive cultivation culture, and collaborative environment.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Senior Systems Support Engineer_Thoughtworks',
  'Senior Systems Support Engineer',
  'Thoughtworks',
  'Ho Chi Minh City, Vietnam',
  'onsite',
  0,
  0,
  'senior',
  '{"Java",".NET","AWS","Azure","GCP","Python","PowerShell","MS SQL","MySQL","PostgreSQL","Docker","Jenkins","Azure Pipelines","DataDog","Prometheus","Grafana"}',
  'Ensure operational efficiency, stability and availability of complex application systems through incident management, DevOps practices, application monitoring, debugging, continuous delivery, and mentoring less experienced peers.',
  'FULL_TIME',
  NULL,
  'Learning and development programs, autonomous career path, supportive cultivation culture, inclusive community.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Software Engineer (C#, .NET)_Thoughtworks',
  'Software Engineer (C#, .NET)',
  'Thoughtworks',
  'Ho Chi Minh City, Vietnam',
  'onsite',
  0,
  0,
  'mid',
  '{"C#",".NET","TDD","Continuous Integration","Continuous Delivery"}',
  'Collaborate with cross-functional teams to design and deliver high-quality software solutions using C#/.NET, clean code, TDD, and continuous delivery practices.',
  'FULL_TIME',
  3,
  'Learning & development programs, career growth support, inclusive and collaborative culture',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Software Engineer (Java)_Thoughtworks',
  'Software Engineer (Java)',
  'Thoughtworks',
  'Ho Chi Minh City',
  'onsite',
  0,
  0,
  'mid',
  '{"Java","Object-Oriented Programming","TDD","Continuous Integration","Continuous Delivery","Agile","Lean","Design Patterns","Pair Programming","AI-assisted tools"}',
  'Develop software solutions using Java and clean code practices like TDD and pair programming, drive AI-first delivery, collaborate in cross-functional teams to build innovative client experiences with continuous delivery and DevOps culture.',
  'FULL_TIME',
  3,
  'Learning and development programs, career growth support, inclusive and collaborative work culture.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';

INSERT INTO public.job_postings (
  tenant_id, external_id, title, company, location, work_mode,
  salary_min_vnd, salary_max_vnd, seniority, required_skills, description,
  job_type, experience_required_years, benefits, education_required, status
) VALUES (
  'b545a6ca-eabe-4bb8-852d-2c497edb8e38',
  'Technical Principal_Thoughtworks',
  'Technical Principal',
  'Thoughtworks',
  'Ho Chi Minh City',
  'onsite',
  0,
  0,
  'principal',
  '{"JavaScript/TypeScript","React","Angular","Vue.js","Node.js","Java (Spring Boot)","Python","PHP","React Native","PostgreSQL","MySQL","Git","GitHub","AWS","TDD","Continuous Integration","Pair Programming","Infrastructure Automation","AI-assisted software development tools","AWS Bedrock AgentCore"}',
  'Serve as technical advisor to client executives, guide solution architecture, drive AI-first software delivery, champion best practices like TDD and pair programming, develop account strategy, cultivate high-performing teams, and ensure security and compliance.',
  'FULL_TIME',
  NULL,
  'Learning and development programs, career growth support, inclusive and supportive culture, autonomous teams.',
  NULL,
  'active'
) ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  company = EXCLUDED.company,
  location = EXCLUDED.location,
  work_mode = EXCLUDED.work_mode,
  salary_min_vnd = EXCLUDED.salary_min_vnd,
  salary_max_vnd = EXCLUDED.salary_max_vnd,
  seniority = EXCLUDED.seniority,
  required_skills = EXCLUDED.required_skills,
  description = EXCLUDED.description,
  job_type = EXCLUDED.job_type,
  experience_required_years = EXCLUDED.experience_required_years,
  benefits = EXCLUDED.benefits,
  education_required = EXCLUDED.education_required,
  status = 'active';
