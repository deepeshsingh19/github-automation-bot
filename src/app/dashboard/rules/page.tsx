import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/auth";
import { getRulesDashboardData } from "@/server/rules/dashboard";

import RuleManager from "./RuleManager";

export default async function RulesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    redirect("/login?callbackUrl=/dashboard/rules");
  }

  const data =
    await getRulesDashboardData(
      session.user.id
    );

  const enabledRules =
    data.rules.filter(
      (rule) => rule.enabled
    ).length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Automation
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Rules
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Build deterministic event rules for GitHub issues and pull requests.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-slate-500">Rules</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {data.rules.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-slate-500">Enabled</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {enabledRules}
            </p>
          </div>
        </div>
      </section>

      <RuleManager
        repositories={data.repositories}
        rules={data.rules}
      />
    </div>
  );
}
