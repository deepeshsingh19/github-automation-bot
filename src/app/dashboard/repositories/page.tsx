import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/auth";
import { getGithubAuthContextFromCurrentRequest } from "@/server/auth/github-token-context";
import { getDashboardRepositories } from "@/server/repositories/dashboard";
import RepositoryManager from "./RepositoryManager";

export default async function RepositoriesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    redirect("/login?callbackUrl=/dashboard/repositories");
  }

  const githubAuth = await getGithubAuthContextFromCurrentRequest();

  if (!githubAuth || githubAuth.userId !== session.user.id) {
    redirect(
      "/login?callbackUrl=/dashboard/repositories&reauth=1"
    );
  }

  const groups = await getDashboardRepositories(
    session.user.id,
    githubAuth.accessToken
  );

  return (
    <main>
      <h1>Repositories</h1>
      <p>Connect repositories that you can administer or push to.</p>

      <RepositoryManager groups={groups} />
    </main>
  );
}
