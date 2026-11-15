import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";

export function EmailField() {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="h-11 rounded-xl" />
    </div>
  );
}

/** `aside` sits at the right end of the label row (e.g. "Forgot password?"). */
export function PasswordField({ isNew = false, aside }: { isNew?: boolean; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Label htmlFor="password">Password</Label>
        {aside}
      </div>
      <PasswordInput
        id="password"
        name="password"
        required
        minLength={isNew ? 8 : undefined}
        autoComplete={isNew ? "new-password" : "current-password"}
        className="h-11 rounded-xl"
      />
      {isNew ? <p className="text-muted-foreground text-xs">At least 12 characters.</p> : null}
    </div>
  );
}

export function FormError({ error }: { error?: string }) {
  return error ? <p className="text-destructive text-sm">{error}</p> : null;
}

/** Two-tone like the app's headings: the title in ink, one muted line under it. */
export function AuthHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-7 flex flex-col gap-1.5">
      <h1 className="text-[22px] leading-tight font-normal tracking-[-0.03em]">{title}</h1>
      <p className="text-muted-foreground text-sm">{sub}</p>
    </div>
  );
}

/** "No account? Sign up" — on the same left edge, set off by a hairline. */
export function AuthFooter({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground mt-8 border-t pt-5 text-sm">{children}</p>;
}
