import "server-only";

import { prisma } from "@/db/client";
import { ruleActionsSchema } from "./action-schema";

export async function getRulesDashboardData(userId: string) {
  const [repositories, rules] = await Promise.all([
    prisma.repository.findMany({
      where: {
        active: true,
        installation: {
          userId,
          active: true,
          suspended: false,
        },
      },
      orderBy: {
        fullName: "asc",
      },
      select: {
        id: true,
        fullName: true,
        slackWebhookEncrypted: true,
      },
    }),

    prisma.rule.findMany({
      where: {
        repository: {
          installation: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        repositoryId: true,
        name: true,
        eventType: true,
        matchField: true,
        matchOperator: true,
        matchValue: true,
        actions: true,
        enabled: true,
        createdAt: true,
        repository: {
          select: {
            fullName: true,
          },
        },
      },
    }),
  ]);

  return {
    repositories: repositories.map((repository) => ({
      id: repository.id,
      fullName: repository.fullName,
      slackConfigured: Boolean(
        repository.slackWebhookEncrypted
      ),
    })),

    rules: rules.map((rule) => {
      const parsedActions = ruleActionsSchema.safeParse(
        rule.actions
      );

      return {
        id: rule.id,
        repositoryId: rule.repositoryId,
        repositoryName: rule.repository.fullName,
        name: rule.name,
        eventType: rule.eventType,
        matchField: rule.matchField,
        matchOperator: rule.matchOperator,
        matchValue: rule.matchValue,
        enabled: rule.enabled,
        actionSummary: parsedActions.success
          ? parsedActions.data.map((action) => {
              switch (action.type) {
                case "addLabel":
                  return `Add label: ${action.label}`;
                case "comment":
                  return "Add comment";
                case "slack":
                  return "Slack notification";
                case "ai":
                  return "AI triage";
              }
            })
          : ["Invalid action configuration"],
      };
    }),
  };
}
