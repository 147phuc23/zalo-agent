import { describe, it, expect } from "vitest";
import {
  ROLE_VALUES,
  SKILL_VALUES,
  AVAILABILITY_VALUES,
  LANGUAGE_VALUES,
  isRoleValue,
  isAvailabilityValue,
  isLanguageValue,
} from "./requirement-taxonomy.js";

describe("requirement-taxonomy", () => {
  it("every canonical value is lowercase", () => {
    for (const list of [ROLE_VALUES, SKILL_VALUES, AVAILABILITY_VALUES, LANGUAGE_VALUES]) {
      for (const value of list) {
        expect(value).toBe(value.toLowerCase());
      }
    }
  });

  it("isRoleValue accepts canonical roles and rejects unknown strings", () => {
    expect(isRoleValue("backend engineer")).toBe(true);
    expect(isRoleValue("Backend Engineer")).toBe(false);
    expect(isRoleValue("astronaut")).toBe(false);
  });

  it("isAvailabilityValue accepts canonical values and rejects unknown strings", () => {
    expect(isAvailabilityValue("immediate")).toBe(true);
    expect(isAvailabilityValue("asap")).toBe(false);
  });

  it("isLanguageValue accepts canonical values and rejects unknown strings", () => {
    expect(isLanguageValue("english")).toBe(true);
    expect(isLanguageValue("French")).toBe(false);
  });
});
