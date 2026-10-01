import { beforeEach } from "vitest";

import { prisma } from "@/db/client";

if (process.env.NODE_ENV !== "test") {
  throw new Error("Tests must run with NODE_ENV=test");
}

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required for tests");
}

beforeEach(async () => {
  await prisma.action.deleteMany();
  await prisma.event.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.installation.deleteMany();
  await prisma.user.deleteMany();
});
