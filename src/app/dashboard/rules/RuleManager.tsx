"use client";

import {
  useActionState,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import {
  createRule,
  deleteRule,
  toggleRule,
  type RuleActionState,
} from "./actions";

type Repository = {
  id: string;
  fullName: string;
  slackConfigured: boolean;
};

type Rule = {
  id: string;
  repositoryId: string;
  repositoryName: string;
  name: string;
  eventType: "ISSUES" | "PULL_REQUEST";
  matchField: "TITLE" | "BODY" | "AUTHOR";
  matchOperator: "CONTAINS" | "EQUALS" | "STARTS_WITH";
  matchValue: string;
  enabled: boolean;
  actionSummary: string[];
};

type Props = {
  repositories: Repository[];
  rules: Rule[];
};

const initialState: RuleActionState = {
  success: false,
};

export default function RuleManager({
  repositories,
  rules,
}: Props) {
  const router = useRouter();

  const [state, formAction, isCreating] = useActionState(
    createRule,
    initialState
  );

  const [selectedRepositoryId, setSelectedRepositoryId] =
    useState(repositories[0]?.id ?? "");

  const [addLabelEnabled, setAddLabelEnabled] =
    useState(false);
  const [commentEnabled, setCommentEnabled] =
    useState(false);
  const [slackEnabled, setSlackEnabled] =
    useState(false);
  const [aiEnabled, setAiEnabled] =
    useState(false);

  const [isPending, startTransition] = useTransition();

  const selectedRepository = useMemo(
    () =>
      repositories.find(
        (repository) =>
          repository.id === selectedRepositoryId
      ),
    [repositories, selectedRepositoryId]
  );

  function handleToggle(ruleId: string, enabled: boolean) {
    startTransition(async () => {
      const result = await toggleRule(ruleId, enabled);

      if (!result.success) {
        return;
      }

      router.refresh();
    });
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      const result = await deleteRule(ruleId);

      if (!result.success) {
        return;
      }

      router.refresh();
    });
  }

  return (
    <div>
      <section>
        <h2>Create rule</h2>

        {repositories.length === 0 ? (
          <p>
            Connect a repository before creating rules.
          </p>
        ) : (
          <form action={formAction}>
            <div>
              <label htmlFor="repositoryId">
                Repository
              </label>

              <select
                id="repositoryId"
                name="repositoryId"
                value={selectedRepositoryId}
                onChange={(event) => {
                  setSelectedRepositoryId(
                    event.target.value
                  );
                  setSlackEnabled(false);
                }}
                required
              >
                {repositories.map((repository) => (
                  <option
                    key={repository.id}
                    value={repository.id}
                  >
                    {repository.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="name">Rule name</label>

              <input
                id="name"
                name="name"
                type="text"
                placeholder="Bug labeler"
                required
              />
            </div>

            <div>
              <label htmlFor="eventType">
                Event type
              </label>

              <select
                id="eventType"
                name="eventType"
                defaultValue="ISSUES"
              >
                <option value="ISSUES">Issues</option>
                <option value="PULL_REQUEST">
                  Pull requests
                </option>
              </select>
            </div>

            <div>
              <label htmlFor="matchField">
                Match field
              </label>

              <select
                id="matchField"
                name="matchField"
                defaultValue="TITLE"
              >
                <option value="TITLE">Title</option>
                <option value="BODY">Body</option>
                <option value="AUTHOR">Author</option>
              </select>
            </div>

            <div>
              <label htmlFor="matchOperator">
                Operator
              </label>

              <select
                id="matchOperator"
                name="matchOperator"
                defaultValue="CONTAINS"
              >
                <option value="CONTAINS">
                  Contains
                </option>
                <option value="EQUALS">
                  Equals
                </option>
                <option value="STARTS_WITH">
                  Starts with
                </option>
              </select>
            </div>

            <div>
              <label htmlFor="matchValue">
                Match value
              </label>

              <input
                id="matchValue"
                name="matchValue"
                type="text"
                placeholder="bug"
                required
              />
            </div>

            <fieldset>
              <legend>Actions</legend>

              <div>
                <label>
                  <input
                    type="checkbox"
                    name="addLabelEnabled"
                    checked={addLabelEnabled}
                    onChange={(event) =>
                      setAddLabelEnabled(
                        event.target.checked
                      )
                    }
                  />
                  Add label
                </label>

                {addLabelEnabled && (
                  <input
                    type="text"
                    name="label"
                    placeholder="bug"
                    required
                  />
                )}
              </div>

              <div>
                <label>
                  <input
                    type="checkbox"
                    name="commentEnabled"
                    checked={commentEnabled}
                    onChange={(event) =>
                      setCommentEnabled(
                        event.target.checked
                      )
                    }
                  />
                  Add comment
                </label>

                {commentEnabled && (
                  <textarea
                    name="comment"
                    placeholder="Thanks for reporting this."
                    required
                  />
                )}
              </div>

              <div>
                <label>
                  <input
                    type="checkbox"
                    name="slackEnabled"
                    checked={slackEnabled}
                    disabled={
                      !selectedRepository?.slackConfigured
                    }
                    onChange={(event) =>
                      setSlackEnabled(
                        event.target.checked
                      )
                    }
                  />
                  Slack notification
                </label>

                {!selectedRepository?.slackConfigured && (
                  <p>
                    Configure Slack on this repository first.
                  </p>
                )}
              </div>

              <div>
                <label>
                  <input
                    type="checkbox"
                    name="aiEnabled"
                    checked={aiEnabled}
                    onChange={(event) =>
                      setAiEnabled(
                        event.target.checked
                      )
                    }
                  />
                  AI triage
                </label>
              </div>
            </fieldset>

            {state.error && <p>{state.error}</p>}

            {state.success && (
              <p>Rule created successfully.</p>
            )}

            <button
              type="submit"
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create rule"}
            </button>
          </form>
        )}
      </section>

      <section>
        <h2>Existing rules</h2>

        {rules.length === 0 ? (
          <p>No rules created yet.</p>
        ) : (
          <ul>
            {rules.map((rule) => (
              <li key={rule.id}>
                <div>
                  <strong>{rule.name}</strong>
                </div>

                <div>
                  Repository: {rule.repositoryName}
                </div>

                <div>
                  Event: {rule.eventType}
                </div>

                <div>
                  Match: {rule.matchField}{" "}
                  {rule.matchOperator}{" "}
                  &quot;{rule.matchValue}&quot;
                </div>

                <div>
                  Actions: {rule.actionSummary.join(", ")}
                </div>

                <div>
                  Status:{" "}
                  {rule.enabled ? "Enabled" : "Disabled"}
                </div>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    handleToggle(rule.id, !rule.enabled)
                  }
                >
                  {rule.enabled ? "Disable" : "Enable"}
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    handleDelete(rule.id)
                  }
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
