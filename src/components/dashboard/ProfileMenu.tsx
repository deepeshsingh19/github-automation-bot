"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export default function ProfileMenu({
  githubLogin,
}: {
  githubLogin: string;
}) {
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const menuRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener(
        "mousedown",
        handleOutsideClick
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [open]);

  async function handleSignOut() {
    setIsSigningOut(true);

    await signOut({
      callbackUrl: "/",
    });
  }

  return (
    <div
      ref={menuRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-2 pr-2.5 transition hover:border-white/15 hover:bg-white/10"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-950">
          {githubLogin
            .slice(0, 2)
            .toUpperCase()}
        </span>

        <span className="hidden max-w-28 truncate text-xs font-medium text-slate-300 sm:block">
          @{githubLogin}
        </span>

        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`h-3.5 w-3.5 text-slate-500 transition ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-1.5 shadow-2xl shadow-black/40"
        >
          <div className="rounded-xl px-3 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
              GitHub account
            </p>

            <p className="mt-1 truncate text-sm font-medium text-slate-200">
              @{githubLogin}
            </p>
          </div>

          <div className="my-1 border-t border-white/5" />

          <button
            type="button"
            role="menuitem"
            onClick={() =>
              void handleSignOut()
            }
            disabled={isSigningOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-rose-400/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="h-3.5 w-3.5"
              >
                <path
                  d="M10 17l5-5-5-5M15 12H3M20 19V5a2 2 0 0 0-2-2h-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            {isSigningOut
              ? "Signing out..."
              : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
