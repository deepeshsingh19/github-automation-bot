import { prisma } from "@/db/client";

import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "github") {
        const githubId = String(account.providerAccountId);

        const githubProfile = profile as {
          login?: string;
          avatar_url?: string;
        };

        const githubLogin =
          githubProfile.login ?? user.name ?? `github-${githubId}`;

        const dbUser = await prisma.user.upsert({
          where: {
            githubId,
          },
          update: {
            githubLogin,
            avatarUrl: user.image ?? githubProfile.avatar_url ?? null,
          },
          create: {
            githubId,
            githubLogin,
            avatarUrl: user.image ?? githubProfile.avatar_url ?? null,
          },
        });

        token.userId = dbUser.id;
        token.githubId = githubId;
        token.githubLogin = githubLogin;
        token.githubAccessToken = account.access_token;
        token.githubAccessTokenExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : null;
      }

      return token;
    },

    async session({ session, token }) {
      if (
        session.user &&
        token.userId &&
        token.githubId &&
        token.githubLogin
      ) {
        session.user.id = token.userId;
        session.user.githubId = token.githubId;
        session.user.githubLogin = token.githubLogin;
      }

      return session;
    },
  },

  secret: process.env.AUTH_SECRET,
};
