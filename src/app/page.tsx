import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main>
      <h1>GitHub Automation Bot</h1>

      {session ? (
        <Link href="/dashboard">Go to dashboard</Link>
      ) : (
        <Link href="/login">Sign in with GitHub</Link>
      )}
    </main>
  );
}
