const fs = require('fs');

const indexPath = '/Users/phuc.dang/.gemini/antigravity/brain/bf79bbe4-c44d-40d7-a9a9-2f0dfdc4a4eb/.system_generated/worktrees/subagent-CV-to-Profile-Developer-self-de111789/packages/database/src/index.ts';

let content = fs.readFileSync(indexPath, 'utf8');

// 1. Add createCandidateProfileRepository to the function exports
const funcTarget = '  createDocumentRepository,\n} from "./repositories.js";';
const funcReplacement = '  createDocumentRepository,\n  createCandidateProfileRepository,\n} from "./repositories.js";';

if (!content.includes(funcTarget)) {
  console.error("Function target not found in index.ts!");
  process.exit(1);
}
content = content.replace(funcTarget, funcReplacement);

// 2. Add CandidateProfileRow, CandidateProfilePatch to the type exports
const typeTarget = '  DocumentRow,\n} from "./repositories.js";';
const typeReplacement = '  DocumentRow,\n  CandidateProfileRow,\n  CandidateProfilePatch,\n} from "./repositories.js";';

if (!content.includes(typeTarget)) {
  console.error("Type target not found in index.ts!");
  process.exit(1);
}
content = content.replace(typeTarget, typeReplacement);

fs.writeFileSync(indexPath, content, 'utf8');
console.log("Successfully edited index.ts!");
