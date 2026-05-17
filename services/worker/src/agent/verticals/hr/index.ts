import type { HrSkillMode } from "../../types.js";

export type VerticalConfig = {
  id: string;
  personaPath: string;
  skillMode: HrSkillMode;
  scenariosPath: string;
};

export const hrVertical: VerticalConfig = {
  id: "hr",
  personaPath: "./persona.md",
  skillMode: "twenty",
  scenariosPath: "./scenarios/hr-scenarios.js",
};
