import { z } from "zod";

export const CompanyResearchJsonSchema = z.object({
  name: z.string(),
  website: z.string().url(),
  introduction: z.string(),
  benefits: z.string(),
  workStyle: z.string(),
  leadership: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      bio: z.string().optional(),
      source_url: z.string().url().optional(),
    })
  ).default([]),
  products: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      url: z.string().url().optional(),
    })
  ).default([]),
  materials: z.array(
    z.object({
      type: z.enum(["book", "blog", "video", "press", "other"]),
      title: z.string(),
      url: z.string().url(),
      description: z.string().optional(),
    })
  ).default([]),
  interviewProcess: z.array(
    z.object({
      round: z.number(),
      name: z.string(),
      description: z.string(),
    })
  ).default([]),
  research: z.record(z.unknown()).default({}),
});

export type CompanyResearchJson = z.infer<typeof CompanyResearchJsonSchema>;
