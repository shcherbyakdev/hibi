import Link from "next/link";
import { redirect } from "next/navigation";
import { HibiLogo } from "@/components/brand/hibi-logo";
import { buttonVariants } from "@/components/ui/button";
import { getOptionalUser } from "@/lib/auth/session";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";
import { cn } from "@/lib/utils";

const MAC_DOWNLOAD = "https://github.com/shcherbyakdev/hibi/releases/latest";

/** Hosted "/": one screen for visitors; signed-in people go straight to the
    planner. Same single left edge as the auth pages (logo, title, copy,
    buttons), just a wider column and a bigger title. */
export default async function Home() {
  if (await getOptionalUser()) redirect(DEFAULT_AFTER_LOGIN);
  const button = "h-10 px-4";
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-[480px] flex-col gap-10">
        <HibiLogo size={22} />
        <div className="flex flex-col gap-4">
          <h1 className="text-[40px] leading-[1.05] font-normal tracking-[-0.04em] text-balance">Plan your day, week and month.</h1>
          <p className="text-muted-foreground text-[15px] leading-relaxed text-pretty">
            hibi (日々, “day after day”) is a quiet planner for tasks, goals and routines. Use it in the browser on every device, or keep
            everything on your Mac with no account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={MAC_DOWNLOAD} className={cn(buttonVariants(), button)}>
            Download for Mac
          </a>
          <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), button)}>
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
