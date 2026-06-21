import { TwentyRecruitingClient, createTwentyRecruitingClientFromEnv } from "../../twenty/recruiting-client.js";

let cached: TwentyRecruitingClient | null = null;

export function getTwentyRecruitingClient(): TwentyRecruitingClient {
  if (!cached) {
    cached = createTwentyRecruitingClientFromEnv();
  }
  return cached;
}
