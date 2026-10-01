import { z } from "zod";

export const aiTriageSchema = z.object({
  summary: z.string().trim().min(1).max(1000),
  suggestedLabel: z.string().trim().min(1).max(50),
  priority: z.enum(["low", "medium", "high"]),
});

export type AiTriageResult = z.infer<typeof aiTriageSchema>;
