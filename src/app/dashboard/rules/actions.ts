"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import {
  MatchField,
  MatchOperator,
  RuleEventType,
} from "@prisma/client";

import { authOptions } from "@/auth";
import { prisma } from "@/db/client";
import { ruleActionsSchema } from "@/server/rules/action-schema";

export type RuleActionState = {
  success: boolean;
  error?: string;
};

const repositoryIdSchema = z.string().cuid();
const ruleIdSchema = z.string().cuid();

const ruleFormSchema = z.object({
  repositoryId: repositoryIdSchema,
  name: z.string().trim().min(1).max(100),
  eventType: z.enum([
    RuleEventType.ISSUES,
    RuleEventType.PULL_REQUEST,
  ]),
  matchField: z.enum([
    MatchField.TITLE,
    MatchField.BODY,
    MatchField.AUTHOR,
  ]),
  matchOperator: z.enum([
    MatchOperator.CONTAINS,
    MatchOperator.EQUALS,
    MatchOperator.STARTS_WITH,
  ]),
  matchValue: z.string().trim().min(1).max(500),
});

function formValue(
  formData: FormData,
  field: string
) {
  const value = formData.get(field);

  return typeof value === "string" ? value : "";
}

function checkboxValue(
  formData: FormData,
  field: string
) {
  return formData.get(field) === "on";
}

export async function createRule(
  _previousState: RuleActionState,
  formData: FormData
): Promise<RuleActionState> {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const parsedRule = ruleFormSchema.safeParse({
    repositoryId: formValue(formData, "repositoryId"),
    name: formValue(formData, "name"),
    eventType: formValue(formData, "eventType"),
    matchField: formValue(formData, "matchField"),
    matchOperator: formValue(formData, "matchOperator"),
    matchValue: formValue(formData, "matchValue"),
  });

  if (!parsedRule.success) {
    return {
      success: false,
      error: "Please provide valid rule details.",
    };
  }

  const addLabelEnabled = checkboxValue(
    formData,
    "addLabelEnabled"
  );

  const commentEnabled = checkboxValue(
    formData,
    "commentEnabled"
  );

  const slackEnabled = checkboxValue(
    formData,
    "slackEnabled"
  );

  const aiEnabled = checkboxValue(
    formData,
    "aiEnabled"
  );

  const actions: Array<
    | { type: "addLabel"; label: string }
    | { type: "comment"; body: string }
    | { type: "slack" }
    | { type: "ai" }
  > = [];

  if (addLabelEnabled) {
    const label = formValue(formData, "label");

    if (!label.trim()) {
      return {
        success: false,
        error: "Provide a label for the add-label action.",
      };
    }

    actions.push({
      type: "addLabel",
      label: label.trim(),
    });
  }

  if (commentEnabled) {
    const body = formValue(formData, "comment");

    if (!body.trim()) {
      return {
        success: false,
        error: "Provide a comment for the comment action.",
      };
    }

    actions.push({
      type: "comment",
      body: body.trim(),
    });
  }

  if (slackEnabled) {
    actions.push({
      type: "slack",
    });
  }

  if (aiEnabled) {
    actions.push({
      type: "ai",
    });
  }

  const parsedActions = ruleActionsSchema.safeParse(actions);

  if (!parsedActions.success) {
    return {
      success: false,
      error: "Select at least one valid action.",
    };
  }

  const repository = await prisma.repository.findFirst({
    where: {
      id: parsedRule.data.repositoryId,
      active: true,
      installation: {
        userId: session.user.id,
        active: true,
        suspended: false,
      },
    },
    select: {
      id: true,
      slackWebhookEncrypted: true,
    },
  });

  if (!repository) {
    return {
      success: false,
      error: "Repository not found.",
    };
  }

  if (slackEnabled && !repository.slackWebhookEncrypted) {
    return {
      success: false,
      error: "Configure Slack for this repository before using Slack actions.",
    };
  }

  await prisma.rule.create({
    data: {
      repositoryId: repository.id,
      name: parsedRule.data.name,
      eventType: parsedRule.data.eventType,
      matchField: parsedRule.data.matchField,
      matchOperator: parsedRule.data.matchOperator,
      matchValue: parsedRule.data.matchValue,
      actions: parsedActions.data,
      enabled: true,
    },
  });

  revalidatePath("/dashboard/rules");

  return {
    success: true,
  };
}

export async function toggleRule(
  ruleIdInput: string,
  enabled: boolean
): Promise<RuleActionState> {
  const parsedRuleId = ruleIdSchema.safeParse(ruleIdInput);

  if (!parsedRuleId.success) {
    return {
      success: false,
      error: "Invalid rule.",
    };
  }

  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const rule = await prisma.rule.findFirst({
    where: {
      id: parsedRuleId.data,
      repository: {
        installation: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!rule) {
    return {
      success: false,
      error: "Rule not found.",
    };
  }

  await prisma.rule.update({
    where: {
      id: rule.id,
    },
    data: {
      enabled,
    },
  });

  revalidatePath("/dashboard/rules");

  return {
    success: true,
  };
}

export async function deleteRule(
  ruleIdInput: string
): Promise<RuleActionState> {
  const parsedRuleId = ruleIdSchema.safeParse(ruleIdInput);

  if (!parsedRuleId.success) {
    return {
      success: false,
      error: "Invalid rule.",
    };
  }

  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const rule = await prisma.rule.findFirst({
    where: {
      id: parsedRuleId.data,
      repository: {
        installation: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!rule) {
    return {
      success: false,
      error: "Rule not found.",
    };
  }

  await prisma.rule.delete({
    where: {
      id: rule.id,
    },
  });

  revalidatePath("/dashboard/rules");

  return {
    success: true,
  };
}
