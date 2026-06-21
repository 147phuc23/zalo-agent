import { z } from "zod";

const TwentyEnvSchema = z.object({
  TWENTY_BASE_URL: z.string().url(),
  TWENTY_API_KEY: z.string().min(10),
});

export type TwentyEnv = z.infer<typeof TwentyEnvSchema>;

export function loadTwentyEnv(input: NodeJS.ProcessEnv = process.env): TwentyEnv {
  const parsed = TwentyEnvSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Twenty mode requires TWENTY_BASE_URL and TWENTY_API_KEY in .env.local: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function normalizeTwentyBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}
