import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">RPM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to your dealership
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
