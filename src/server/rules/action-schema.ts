import { z } from "zod";

const addLabelActionSchema = z.object({
  type: z.literal("addLabel"),
  label: z.string().trim().min(1).max(50),
});

const commentActionSchema = z.object({
  type: z.literal("comment"),
  body: z.string().trim().min(1).max(2000),
});

const slackActionSchema = z.object({
  type: z.literal("slack"),
});

const aiActionSchema = z.object({
  type: z.literal("ai"),
});

export const ruleActionSchema = z.discriminatedUnion("type", [
  addLabelActionSchema,
  commentActionSchema,
  slackActionSchema,
  aiActionSchema,
]);

export const ruleActionsSchema = z
  .array(ruleActionSchema)
  .min(1)
  .max(10);

export type RuleAction = z.infer<typeof ruleActionSchema>;
export type RuleActions = z.infer<typeof ruleActionsSchema>;
