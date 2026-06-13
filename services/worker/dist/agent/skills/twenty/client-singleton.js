import { createTwentyRecruitingClientFromEnv } from "../../twenty/recruiting-client.js";
let cached = null;
export function getTwentyRecruitingClient() {
    if (!cached) {
        cached = createTwentyRecruitingClientFromEnv();
    }
    return cached;
}
