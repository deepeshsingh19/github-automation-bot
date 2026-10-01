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

const fieldLabels: Record<Rule["matchField"], string> = {
  TITLE: "Title",
  BODY: "Body",
  AUTHOR: "Author",
};

const operatorLabels: Record<
  Rule["matchOperator"],
  string
> = {
  CONTAINS: "contains",
  EQUALS: "equals",
  STARTS_WITH: "starts with",
};

export default function RuleManager({
  repositories,
  rules,
}: Props) {
  const router = useRouter();

  const [state, formAction, isCreating] =
    useActionState(
      createRule,
      initialState
    );

  const [selectedRepositoryId, setSelectedRepositoryId] =
    useState(
      repositories[0]?.id ?? ""
    );

  const [addLabelEnabled, setAddLabelEnabled] =
    useState(false);

  const [commentEnabled, setCommentEnabled] =
    useState(false);

  const [slackEnabled, setSlackEnabled] =
    useState(false);

  const [aiEnabled, setAiEnabled] =
    useState(false);

  const [isPending, startTransition] =
    useTransition();

  const selectedRepository = useMemo(
    () =>
      repositories.find(
        (repository) =>
          repository.id ===
          selectedRepositoryId
      ),
    [
      repositories,
      selectedRepositoryId,
    ]
  );

  function handleToggle(
    ruleId: string,
    enabled: boolean
  ) {
    startTransition(async () => {
      const result =
        await toggleRule(
          ruleId,
          enabled
        );

      if (!result.success) {
        return;
      }

      router.refresh();
    });
  }

  function handleDelete(
    ruleId: string
  ) {
    startTransition(async () => {
      const result =
        await deleteRule(ruleId);

      if (!result.success) {
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-5 py-5 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Rule builder
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Create an automation
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Match an issue or pull request and choose what should happen.
          </p>
        </div>

        {repositories.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <p className="text-sm font-medium text-slate-300">
              Connect a repository first.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Rules are attached to connected repositories.
            </p>
          </div>
        ) : (
          <form
            action={formAction}
            className="space-y-7 p-5 sm:p-6"
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label
                  htmlFor="repositoryId"
                  className="text-xs font-medium text-slate-400"
                >
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
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none transition focus:border-white/25"
                >
                  {repositories.map(
                    (repository) => (
                      <option
                        key={repository.id}
                        value={repository.id}
                      >
                        {repository.fullName}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="name"
                  className="text-xs font-medium text-slate-400"
                >
                  Rule name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Bug labeler"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-white/25"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600">
                When this happens
              </p>

              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <div>
                  <label
                    htmlFor="eventType"
                    className="text-xs text-slate-500"
                  >
                    Event
                  </label>
                  <select
                    id="eventType"
                    name="eventType"
                    defaultValue="ISSUES"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-white/25"
                  >
                    <option value="ISSUES">
                      Issues
                    </option>
                    <option value="PULL_REQUEST">
                      Pull requests
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="matchField"
                    className="text-xs text-slate-500"
                  >
                    Field
                  </label>
                  <select
                    id="matchField"
                    name="matchField"
                    defaultValue="TITLE"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-white/25"
                  >
                    <option value="TITLE">
                      Title
                    </option>
                    <option value="BODY">
                      Body
                    </option>
                    <option value="AUTHOR">
                      Author
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="matchOperator"
                    className="text-xs text-slate-500"
                  >
                    Operator
                  </label>
                  <select
                    id="matchOperator"
                    name="matchOperator"
                    defaultValue="CONTAINS"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-white/25"
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
              </div>

              <div className="mt-4">
                <label
                  htmlFor="matchValue"
                  className="text-xs text-slate-500"
                >
                  Match value
                </label>
                <input
                  id="matchValue"
                  name="matchValue"
                  type="text"
                  placeholder="bug"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-white/25"
                />
              </div>
            </div>

            <fieldset>
              <legend className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600">
                Actions
              </legend>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 transition hover:border-white/15">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Add label
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Apply a GitHub label.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      name="addLabelEnabled"
                      checked={addLabelEnabled}
                      onChange={(event) =>
                        setAddLabelEnabled(
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 accent-white"
                    />
                  </div>

                  {addLabelEnabled && (
                    <input
                      type="text"
                      name="label"
                      placeholder="bug"
                      required
                      className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-white/25"
                    />
                  )}
                </label>

                <label className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 transition hover:border-white/15">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Add comment
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Post a comment on GitHub.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      name="commentEnabled"
                      checked={commentEnabled}
                      onChange={(event) =>
                        setCommentEnabled(
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 accent-white"
                    />
                  </div>

                  {commentEnabled && (
                    <textarea
                      name="comment"
                      placeholder="Thanks for reporting this."
                      required
                      rows={3}
                      className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-white/25"
                    />
                  )}
                </label>

                <label
                  className={`rounded-2xl border border-white/10 bg-slate-950/70 p-4 transition ${
                    selectedRepository?.slackConfigured
                      ? "hover:border-white/15"
                      : "opacity-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Slack notification
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Send the event to the configured Slack webhook.
                      </p>
                    </div>
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
                      className="h-4 w-4 accent-white"
                    />
                  </div>

                  {!selectedRepository?.slackConfigured && (
                    <p className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
                      Configure Slack on this repository first.
                    </p>
                  )}
                </label>

                <label className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 transition hover:border-white/15">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        AI triage
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Generate a summary, label suggestion, and priority.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      name="aiEnabled"
                      checked={aiEnabled}
                      onChange={(event) =>
                        setAiEnabled(
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 accent-white"
                    />
                  </div>
                </label>
              </div>
            </fieldset>

            {state.error && (
              <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-3.5 py-3 text-sm text-rose-300">
                {state.error}
              </div>
            )}

            {state.success && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3.5 py-3 text-sm text-emerald-300">
                Rule created successfully.
              </div>
            )}

            <div className="flex justify-end border-t border-white/10 pt-5">
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating
                  ? "Creating..."
                  : "Create rule"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Automation library
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Existing rules
            </h2>
          </div>

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-500">
            {rules.length} total
          </span>
        </div>

        {rules.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
            <p className="text-sm font-medium text-slate-300">
              No rules created yet.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Your first rule will appear here after you create it.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {rules.map((rule) => (
              <article
                key={rule.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">
                        {rule.name}
                      </h3>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          rule.enabled
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                            : "border-slate-400/20 bg-slate-400/10 text-slate-500"
                        }`}
                      >
                        {rule.enabled
                          ? "Enabled"
                          : "Disabled"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {rule.repositoryName}
                    </p>
                  </div>

                  <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                    {rule.eventType ===
                    "PULL_REQUEST"
                      ? "PR"
                      : "Issue"}
                  </span>
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">
                    Match condition
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {fieldLabels[rule.matchField]}{" "}
                    {operatorLabels[
                      rule.matchOperator
                    ]}{" "}
                    <span className="font-medium text-white">
                      “{rule.matchValue}”
                    </span>
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-xs text-slate-500">
                    Actions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rule.actionSummary.map(
                      (action) => (
                        <span
                          key={action}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400"
                        >
                          {action}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div className="mt-5 flex gap-2 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      handleToggle(
                        rule.id,
                        !rule.enabled
                      )
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
                  >
                    {rule.enabled
                      ? "Disable"
                      : "Enable"}
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      handleDelete(rule.id)
                    }
                    className="rounded-xl border border-rose-400/15 bg-rose-400/5 px-3.5 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
