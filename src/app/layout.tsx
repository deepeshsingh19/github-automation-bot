import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "GitHub Automation Bot",
    template: "%s · GitHub Automation Bot",
  },
  description:
    "Event-driven GitHub automation with durable processing, rules, AI triage, and Slack notifications.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
