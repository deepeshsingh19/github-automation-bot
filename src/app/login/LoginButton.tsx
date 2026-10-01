"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

function GithubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M12 .7a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.06c-3.34.73-4.04-1.41-4.04-1.41-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.08-.73.08-.73 1.2.09 1.83 1.23 1.83 1.23 1.07 1.82 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6-.02c2.29-1.55 3.29-1.23 3.29-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .7Z" />
    </svg>
  );
}

export default function LoginButton({
  callbackUrl,
}: {
  callbackUrl: string;
}) {
  const [isLoading, setIsLoading] =
    useState(false);

  async function handleSignIn() {
    setIsLoading(true);

    await signIn("github", {
      callbackUrl,
    });
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignIn()}
      disabled={isLoading}
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <GithubIcon />
      {isLoading
        ? "Connecting to GitHub..."
        : "Continue with GitHub"}
    </button>
  );
}
