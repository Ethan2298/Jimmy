import { PinForm } from "@/components/oauth/pin-form";

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect_uri?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Jimmy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your PIN to connect
          </p>
        </div>
        <PinForm
          redirectUri={params.redirect_uri || ""}
          state={params.state || ""}
          codeChallenge={params.code_challenge || ""}
        />
      </div>
    </div>
  );
}
