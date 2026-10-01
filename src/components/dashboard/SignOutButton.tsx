"use client";

import { signOut } from "next-auth/react";
import { useTransition } from "react";

export default function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(() => {
      void signOut({
        callbackUrl: "/",
      });
    });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
