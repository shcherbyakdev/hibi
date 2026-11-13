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

export function PasswordField({ isNew = false }: { isNew?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="password">Password</Label>
      <PasswordInput
        id="password"
        name="password"
        required
        minLength={isNew ? 8 : undefined}
        autoComplete={isNew ? "new-password" : "current-password"}
        className="h-11 rounded-xl"
      />
      {isNew ? <p className="text-muted-foreground text-xs">At least 8 characters.</p> : null}
    </div>
  );
}

export function FormError({ error }: { error?: string }) {
  return error ? <p className="text-destructive text-sm">{error}</p> : null;
}
