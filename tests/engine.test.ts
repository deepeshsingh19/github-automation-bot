import { describe, expect, it } from "vitest";

import {
  MatchField,
  MatchOperator,
  RuleEventType,
} from "@prisma/client";

import {
  evaluateRules,
  type NormalizedEventPayload,
  type RuleForEvaluation,
} from "@/server/rules/engine";

const payload: NormalizedEventPayload = {
  repository: {
    id: "repo-1",
    owner: "deepeshsingh19",
    name: "test-repo",
    fullName: "deepeshsingh19/test-repo",
  },
  item: {
    number: 10,
    title: "Bug: login fails",
    body: "Users cannot login from mobile.",
    author: "deepesh",
    labels: [],
    htmlUrl: "https://github.com/deepeshsingh19/test-repo/issues/10",
  },
};

function rule(
  overrides: Partial<RuleForEvaluation> = {}
): RuleForEvaluation {
  return {
    id: "rule-1",
    eventType: RuleEventType.ISSUES,
    matchField: MatchField.TITLE,
    matchOperator: MatchOperator.CONTAINS,
    matchValue: "bug",
    enabled: true,
    actions: [
      {
        type: "addLabel",
        label: "bug",
      },
      {
        type: "comment",
        body: "Thanks for reporting this.",
      },
    ],
    ...overrides,
  };
}

describe("evaluateRules", () => {
  it("matches a title and creates planned actions", () => {
    const result = evaluateRules(
      [rule()],
      RuleEventType.ISSUES,
      payload
    );

    expect(result).toHaveLength(2);

    expect(result[0].actionKey).toBe(
      "rule:rule-1:add_label:bug"
    );

    expect(result[1].actionKey).toBe(
      "rule:rule-1:comment"
    );
  });

  it("matches the body", () => {
    const result = evaluateRules(
      [
        rule({
          matchField: MatchField.BODY,
          matchOperator: MatchOperator.CONTAINS,
          matchValue: "mobile",
          actions: [
            {
              type: "addLabel",
              label: "mobile",
            },
          ],
        }),
      ],
      RuleEventType.ISSUES,
      payload
    );

    expect(result).toHaveLength(1);
    expect(result[0].definition).toEqual({
      type: "addLabel",
      label: "mobile",
    });
  });

  it("matches the author with equals", () => {
    const result = evaluateRules(
      [
        rule({
          matchField: MatchField.AUTHOR,
          matchOperator: MatchOperator.EQUALS,
          matchValue: "Deepesh",
          actions: [
            {
              type: "comment",
              body: "Welcome.",
            },
          ],
        }),
      ],
      RuleEventType.ISSUES,
      payload
    );

    expect(result).toHaveLength(1);
  });

  it("does not match a different event type", () => {
    const result = evaluateRules(
      [rule()],
      RuleEventType.PULL_REQUEST,
      payload
    );

    expect(result).toHaveLength(0);
  });

  it("does not match a disabled rule", () => {
    const result = evaluateRules(
      [
        rule({
          enabled: false,
        }),
      ],
      RuleEventType.ISSUES,
      payload
    );

    expect(result).toHaveLength(0);
  });

  it("supports starts with", () => {
    const result = evaluateRules(
      [
        rule({
          matchOperator: MatchOperator.STARTS_WITH,
          matchValue: "bug:",
          actions: [
            {
              type: "addLabel",
              label: "bug",
            },
          ],
        }),
      ],
      RuleEventType.ISSUES,
      payload
    );

    expect(result).toHaveLength(1);
  });

  it("deduplicates AI triage", () => {
    const result = evaluateRules(
      [
        rule({
          id: "rule-1",
          actions: [{ type: "ai" }],
        }),
        rule({
          id: "rule-2",
          actions: [{ type: "ai" }],
        }),
      ],
      RuleEventType.ISSUES,
      payload
    );

    expect(result).toHaveLength(1);
    expect(result[0].actionKey).toBe("ai:triage");
    expect(result[0].ruleId).toBeNull();
  });

  it("throws for invalid stored actions", () => {
    expect(() =>
      evaluateRules(
        [
          rule({
            actions: [{ invalid: true }],
          }),
        ],
        RuleEventType.ISSUES,
        payload
      )
    ).toThrow();
  });
});
