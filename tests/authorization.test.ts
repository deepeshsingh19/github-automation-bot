import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const prismaMock = vi.hoisted(() => ({
  installation: {
    findFirst: vi.fn(),
  },
  repository: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

const githubContextMock = vi.hoisted(() => ({
  getGithubAuthContextFromCurrentRequest:
    vi.fn(),
}));

const githubRepositoriesMock =
  vi.hoisted(() => ({
    listInstallationRepositories:
      vi.fn(),
  }));

const githubInstallationsMock =
  vi.hoisted(() => ({
    verifyGithubInstallation:
      vi.fn(),
  }));

const revalidatePathMock = vi.hoisted(
  () => vi.fn()
);

vi.mock("@/db/client", () => ({
  prisma: prismaMock,
}));

vi.mock("next-auth", () => ({
  getServerSession:
    authMock.getServerSession,
}));

vi.mock("next/cache", () => ({
  revalidatePath:
    revalidatePathMock,
}));

vi.mock(
  "@/server/auth/github-token-context",
  () => ({
    getGithubAuthContextFromCurrentRequest:
      githubContextMock.getGithubAuthContextFromCurrentRequest,
  })
);

vi.mock(
  "@/server/github/repositories",
  () => ({
    listInstallationRepositories:
      githubRepositoriesMock.listInstallationRepositories,
  })
);

vi.mock(
  "@/server/github/installations",
  () => ({
    verifyGithubInstallation:
      githubInstallationsMock.verifyGithubInstallation,
  })
);

vi.mock(
  "@/auth",
  () => ({
    authOptions: {},
  })
);

import {
  connectRepository,
  configureSlackWebhook,
  disconnectRepository,
} from "@/app/dashboard/repositories/actions";

const userId = "user-owner";
const otherUserId = "user-other";
const installationId =
  "cminstallation123456789";
const repositoryId =
  "cmrepository123456789";
const githubRepoId =
  "123456789";

function authenticate(
  sessionUserId = userId,
  contextUserId = userId
) {
  authMock.getServerSession.mockResolvedValue({
    user: {
      id: sessionUserId,
    },
  });

  githubContextMock
    .getGithubAuthContextFromCurrentRequest
    .mockResolvedValue({
      userId: contextUserId,
      accessToken: "test-github-token",
    });
}

function mockInstallation() {
  prismaMock.installation.findFirst.mockResolvedValue(
    {
      id: installationId,
      githubId: BigInt(987654321),
    }
  );
}

function mockAccessibleRepository(
  permissions: {
    push?: boolean;
    admin?: boolean;
  } = {
    push: true,
  }
) {
  githubRepositoriesMock
    .listInstallationRepositories
    .mockResolvedValue([
      {
        id: Number(githubRepoId),
        owner: {
          login: "deepeshsingh19",
        },
        name: "test-repo",
        full_name:
          "deepeshsingh19/test-repo",
        permissions,
      },
    ]);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("repository authorization", () => {
  it("rejects unauthenticated repository connection", async () => {
    authMock.getServerSession.mockResolvedValue(
      null
    );

    githubContextMock
      .getGithubAuthContextFromCurrentRequest
      .mockResolvedValue(null);

    const result =
      await connectRepository(
        installationId,
        githubRepoId
      );

    expect(result).toEqual({
      success: false,
      error: "Authentication required.",
    });

    expect(
      prismaMock.installation.findFirst
    ).not.toHaveBeenCalled();
  });

  it("rejects when the session and GitHub auth belong to different users", async () => {
    authenticate(
      userId,
      otherUserId
    );

    const result =
      await connectRepository(
        installationId,
        githubRepoId
      );

    expect(result).toEqual({
      success: false,
      error: "Authentication required.",
    });

    expect(
      prismaMock.installation.findFirst
    ).not.toHaveBeenCalled();
  });

  it("does not allow access to another user's installation", async () => {
    authenticate();

    prismaMock.installation.findFirst.mockResolvedValue(
      null
    );

    const result =
      await connectRepository(
        installationId,
        githubRepoId
      );

    expect(result).toEqual({
      success: false,
      error: "Installation not found.",
    });

    expect(
      githubRepositoriesMock
        .listInstallationRepositories
    ).not.toHaveBeenCalled();
  });

  it("rejects a repository where the user has no push or admin permission", async () => {
    authenticate();
    mockInstallation();
    mockAccessibleRepository({
      push: false,
      admin: false,
    });

    const result =
      await connectRepository(
        installationId,
        githubRepoId
      );

    expect(result).toEqual({
      success: false,
      error:
        "You need push or admin access to connect this repository.",
    });

    expect(
      prismaMock.repository.create
    ).not.toHaveBeenCalled();

    expect(
      prismaMock.repository.update
    ).not.toHaveBeenCalled();
  });

  it("rejects a repository that is already connected to another installation", async () => {
    authenticate();
    mockInstallation();
    mockAccessibleRepository({
      push: true,
    });

    prismaMock.repository.findUnique.mockResolvedValue(
      {
        id: repositoryId,
        installationId: "other-installation",
        active: true,
        installation: {
          userId: otherUserId,
          active: true,
          suspended: false,
        },
      }
    );

    const result =
      await connectRepository(
        installationId,
        githubRepoId
      );

    expect(result).toEqual({
      success: false,
      error:
        "Repository is already connected to another installation.",
    });

    expect(
      prismaMock.repository.create
    ).not.toHaveBeenCalled();

    expect(
      prismaMock.repository.update
    ).not.toHaveBeenCalled();
  });

  it("only disconnects repositories owned by the authenticated user", async () => {
    authenticate();

    prismaMock.repository.findFirst.mockResolvedValue(
      null
    );

    const result =
      await disconnectRepository(
        repositoryId
      );

    expect(result).toEqual({
      success: false,
      error: "Repository not found.",
    });

    expect(
      prismaMock.repository.update
    ).not.toHaveBeenCalled();

    expect(
      prismaMock.repository.findFirst
    ).toHaveBeenCalledWith({
      where: {
        id: repositoryId,
        installation: {
          userId,
        },
      },
      select: {
        id: true,
      },
    });
  });

  it("only configures Slack for an active repository owned by the user", async () => {
    authenticate();

    prismaMock.repository.findFirst.mockResolvedValue(
      null
    );

    const result =
      await configureSlackWebhook(
        repositoryId,
        "https://hooks.slack.com/services/T000/B000/secret"
      );

    expect(result).toEqual({
      success: false,
      error: "Repository not found.",
    });

    expect(
      prismaMock.repository.update
    ).not.toHaveBeenCalled();

    expect(
      prismaMock.repository.findFirst
    ).toHaveBeenCalledWith({
      where: {
        id: repositoryId,
        active: true,
        installation: {
          userId,
          active: true,
          suspended: false,
        },
      },
      select: {
        id: true,
      },
    });
  });

  it("reclaims a repository from a stale old installation after reinstall", async () => {
    authenticate();
    mockInstallation();
    mockAccessibleRepository({
      push: true,
    });

    prismaMock.repository.findUnique.mockResolvedValue({
      id: repositoryId,
      installationId: "old-installation",
      active: true,
      installation: {
        userId,
        active: true,
        suspended: false,
        githubId: BigInt(876543210),
      },
    });

    githubInstallationsMock.verifyGithubInstallation.mockResolvedValue(
      null
    );

    prismaMock.repository.update.mockResolvedValue({
      id: repositoryId,
    });

    const result =
      await connectRepository(
        installationId,
        githubRepoId
      );

    expect(result).toEqual({
      success: true,
    });

    expect(
      githubInstallationsMock.verifyGithubInstallation
    ).toHaveBeenCalledWith(
      "test-github-token",
      "876543210"
    );

    expect(
      prismaMock.repository.update
    ).toHaveBeenCalledWith({
      where: {
        id: repositoryId,
      },
      data: {
        installationId,
        owner: "deepeshsingh19",
        name: "test-repo",
        fullName:
          "deepeshsingh19/test-repo",
        active: true,
      },
    });
  });

  it("rejects a repository when the user's old installation is still active on GitHub", async () => {
    authenticate();
    mockInstallation();
    mockAccessibleRepository({
      push: true,
    });

    prismaMock.repository.findUnique.mockResolvedValue({
      id: repositoryId,
      installationId: "old-installation",
      active: true,
      installation: {
        userId,
        active: true,
        suspended: false,
        githubId: BigInt(876543211),
      },
    });

    githubInstallationsMock.verifyGithubInstallation.mockResolvedValue({
      id: 876543211,
      account: {
        login: "deepeshsingh19",
        id: 12345,
      },
      app_id: 123456,
      app_slug: "github-automation-bot",
      suspended_at: null,
      repository_selection: "selected",
    });

    const result =
      await connectRepository(
        installationId,
        githubRepoId
      );

    expect(result).toEqual({
      success: false,
      error:
        "Repository is already connected to another installation.",
    });

    expect(
      prismaMock.repository.update
    ).not.toHaveBeenCalled();

    expect(
      prismaMock.repository.create
    ).not.toHaveBeenCalled();
  });

  it("allows an authorized user to connect an accessible repository", async () => {
    authenticate();
    mockInstallation();
    mockAccessibleRepository({
      admin: true,
    });

    prismaMock.repository.findUnique.mockResolvedValue(
      null
    );

    prismaMock.repository.create.mockResolvedValue({
      id: repositoryId,
    });

    const result =
      await connectRepository(
        installationId,
        githubRepoId
      );

    expect(result).toEqual({
      success: true,
    });

    expect(
      prismaMock.repository.create
    ).toHaveBeenCalledWith({
      data: {
        githubRepoId: BigInt(
          githubRepoId
        ),
        installationId,
        owner: "deepeshsingh19",
        name: "test-repo",
        fullName:
          "deepeshsingh19/test-repo",
        active: true,
      },
    });

    expect(
      revalidatePathMock
    ).toHaveBeenCalledWith(
      "/dashboard/repositories"
    );
  });
});
