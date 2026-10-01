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

  const data = await getRulesDashboardData(
    session.user.id
  );

  return (
    <main>
      <h1>Rules</h1>

      <p>
        Configure event matching and automation actions.
      </p>

      <RuleManager
        repositories={data.repositories}
        rules={data.rules}
      />
    </main>
  );
}
