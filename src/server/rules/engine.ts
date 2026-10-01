import {
  ActionType,
  MatchField,
  MatchOperator,
  RuleEventType,
} from "@prisma/client";

import {
  ruleActionsSchema,
  type RuleAction,
} from "./action-schema";

export type NormalizedEventPayload = {
  repository: {
    id: string;
    owner: string;
    name: string;
    fullName: string;
  };
  item: {
    number: number;
    title: string;
    body: string;
    author: string;
    labels: string[];
    htmlUrl: string;
  };
};

export type RuleForEvaluation = {
  id: string;
  eventType: RuleEventType;
  matchField: MatchField;
  matchOperator: MatchOperator;
  matchValue: string;
  enabled: boolean;
  actions: unknown;
};

export type PlannedAction = {
  actionType: ActionType;
  actionKey: string;
  ruleId: string | null;
  definition: RuleAction;
};

function getMatchValue(
  payload: NormalizedEventPayload,
  field: MatchField
) {
  switch (field) {
    case MatchField.TITLE:
      return payload.item.title;

    case MatchField.BODY:
      return payload.item.body;

    case MatchField.AUTHOR:
      return payload.item.author;
  }
}

function matchesRule(
  actual: string,
  operator: MatchOperator,
  expected: string
) {
  const normalizedActual = actual.trim().toLowerCase();
  const normalizedExpected = expected.trim().toLowerCase();

  switch (operator) {
    case MatchOperator.CONTAINS:
      return normalizedActual.includes(normalizedExpected);

    case MatchOperator.EQUALS:
      return normalizedActual === normalizedExpected;

    case MatchOperator.STARTS_WITH:
      return normalizedActual.startsWith(normalizedExpected);
  }
}

function toPlannedAction(
  rule: RuleForEvaluation,
  action: RuleAction
): PlannedAction | null {
  switch (action.type) {
    case "addLabel":
      return {
        actionType: ActionType.ADD_LABEL,
        actionKey: `rule:${rule.id}:add_label:${action.label}`,
        ruleId: rule.id,
        definition: action,
      };

    case "comment":
      return {
        actionType: ActionType.COMMENT,
        actionKey: `rule:${rule.id}:comment`,
        ruleId: rule.id,
        definition: action,
      };

    case "slack":
      return {
        actionType: ActionType.SLACK,
        actionKey: `rule:${rule.id}:slack`,
        ruleId: rule.id,
        definition: action,
      };

    case "ai":
      return {
        actionType: ActionType.AI,
        actionKey: "ai:triage",
        ruleId: null,
        definition: action,
      };
  }
}

export function evaluateRules(
  rules: RuleForEvaluation[],
  eventType: RuleEventType,
  payload: NormalizedEventPayload
): PlannedAction[] {
  const plannedActions: PlannedAction[] = [];
  const seenActionKeys = new Set<string>();

  for (const rule of rules) {
    if (!rule.enabled || rule.eventType !== eventType) {
      continue;
    }

    const actualValue = getMatchValue(payload, rule.matchField);

    if (
      !matchesRule(
        actualValue,
        rule.matchOperator,
        rule.matchValue
      )
    ) {
      continue;
    }

    const parsedActions = ruleActionsSchema.safeParse(
      rule.actions
    );

    if (!parsedActions.success) {
      throw new Error(`Invalid actions for rule ${rule.id}`);
    }

    for (const action of parsedActions.data) {
      const plannedAction = toPlannedAction(rule, action);

      if (!plannedAction) {
        continue;
      }

      if (seenActionKeys.has(plannedAction.actionKey)) {
        continue;
      }

      seenActionKeys.add(plannedAction.actionKey);
      plannedActions.push(plannedAction);
    }
  }

  return plannedActions;
}
