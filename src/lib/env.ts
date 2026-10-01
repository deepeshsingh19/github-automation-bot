import "server-only";

import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    APP_URL: z.string().url(),
    NEXTAUTH_URL: z.string().url(),

    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),

    AUTH_SECRET: z.string().min(32),
    AUTH_GITHUB_ID: z.string().min(1),
    AUTH_GITHUB_SECRET: z.string().min(1),

    GITHUB_APP_ID: z.string().regex(/^\d+$/),
    GITHUB_APP_SLUG: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z
      .string()
      .min(1)
      .transform((value) => value.replace(/\\n/g, "\n")),
    GITHUB_WEBHOOK_SECRET: z.string().min(16),

    ENCRYPTION_KEY: z
      .string()
      .refine(
        (value) => {
          try {
            return Buffer.from(value, "base64").length === 32;
          } catch {
            return false;
          }
        },
        { message: "ENCRYPTION_KEY must be base64 encoded 32 bytes" }
      ),

    SWEEP_SECRET: z.string().min(16),

    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().default("gemini-2.5-flash-lite"),

    WORKER_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
  })
  .superRefine((values, context) => {
    const appUrl = values.APP_URL.replace(/\/$/, "");
    const nextAuthUrl = values.NEXTAUTH_URL.replace(/\/$/, "");

    if (appUrl !== nextAuthUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXTAUTH_URL"],
        message: "NEXTAUTH_URL must match APP_URL",
      });
    }

    for (const [name, value] of [
      ["APP_URL", values.APP_URL],
      ["NEXTAUTH_URL", values.NEXTAUTH_URL],
    ] as const) {
      const isLocalhost =
        value.startsWith("http://localhost") ||
        value.startsWith("http://127.0.0.1");

      if (values.NODE_ENV === "production" && !isLocalhost) {
        if (!value.startsWith("https://")) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [name],
            message: `${name} must use HTTPS in production`,
          });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }))
  );

  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
