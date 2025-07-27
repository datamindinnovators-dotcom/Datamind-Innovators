import { LoginForm } from "@/components/login-form";
import { Icons } from "@/components/icons";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
            <Icons.logo className="h-12 w-12 text-primary"/>
            <h1 className="text-3xl font-bold font-headline">Classroom Hub</h1>
            <p className="text-muted-foreground">Sign in to access your dashboard</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
