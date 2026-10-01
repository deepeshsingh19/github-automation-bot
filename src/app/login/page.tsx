import LoginButton from "./LoginButton";

function getSafeCallbackUrl(value: unknown) {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return value;
  }

  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string | string[];
  }>;
}) {
  const params = await searchParams;

  const callbackUrl = getSafeCallbackUrl(
    Array.isArray(params.callbackUrl)
      ? params.callbackUrl[0]
      : params.callbackUrl
  );

  return (
    <main>
      <h1>GitHub Automation Bot</h1>
      <p>Sign in with GitHub to continue.</p>
      <LoginButton callbackUrl={callbackUrl} />
    </main>
  );
}
