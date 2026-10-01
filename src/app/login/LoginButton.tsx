"use client";

import { signIn } from "next-auth/react";

export default function LoginButton({
  callbackUrl,
}: {
  callbackUrl: string;
}) {
  return (
    <button
      type="button"
      onClick={() => signIn("github", { callbackUrl })}
    >
      Continue with GitHub
    </button>
  );
}
