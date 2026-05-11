# Load Jobs
Description: Query and filter mocked job postings for HR recruiter conversations.

Use this skill when the candidate has enough requirement details to search jobs, or when the agent needs to explain what opportunities are available.

Input contract:
- `role`: desired role.
- `location`: desired location.
- `workMode`: remote, hybrid, or onsite.
- `salaryMinVnd`: expected minimum salary.
- `skills`: relevant skills.

Output contract:
- Matching jobs sorted by rough relevance.
- `filtersApplied` for transparency.
