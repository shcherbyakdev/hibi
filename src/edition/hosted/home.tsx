import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { HibiLogo } from "@/components/brand/hibi-logo";
import { getOptionalUser } from "@/lib/auth/session";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";

const MAC_DOWNLOAD = "https://github.com/shcherbyakdev/hibi/releases/latest";

/** Hosted "/": one hero for visitors; signed-in people go straight to the
    planner. Always the dusk scene (white on dark) whatever the theme: it's
    a picture, not chrome. The CTA lands on today's plan; signed-out
    visitors pass through /login?next=/plan/day on the way. */
export default async function Home() {
  if (await getOptionalUser()) redirect(DEFAULT_AFTER_LOGIN);
  return (
    <main className="relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden bg-[#101b25] text-white">
      <DuskScene />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <HibiLogo size={22} />
        <Link
          href="/login"
          className="inline-flex h-10 items-center rounded-md border border-white/35 px-4 text-sm font-medium transition-colors hover:bg-white/10"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-[10vh] pb-24 text-center">
        <p className="rounded-md bg-white/10 px-3 py-1 text-sm text-white/85 backdrop-blur-sm">日々 · day after day</p>
        <h1 className="font-brand mt-6 text-[clamp(2.6rem,7vw,4.75rem)] leading-[1.04] font-medium tracking-[-0.03em] text-balance">
          One good day, then the next.
        </h1>
        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-pretty text-white/80">
          hibi is a quiet planner for tasks, goals and routines. Plan today, see the week, steer the month.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href={DEFAULT_AFTER_LOGIN}
            className="inline-flex h-12 items-center gap-2 rounded-md bg-white px-6 font-medium text-[#101b25] shadow-[0_0_28px_rgba(255,186,140,0.55)] transition-[box-shadow,transform] duration-150 hover:shadow-[0_0_40px_rgba(255,186,140,0.75)] active:scale-[0.98]"
          >
            Create your first task
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <a
            href={MAC_DOWNLOAD}
            className="inline-flex h-12 items-center rounded-md border border-white/35 bg-white/5 px-6 font-medium backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Download for Mac
          </a>
        </div>
        <p className="mt-5 text-sm text-white/60">
          The web app is invite-only for now.{" "}
          <Link href="/signup" className="text-white/85 underline-offset-4 hover:underline">
            Request access
          </Link>
        </p>
      </section>
    </main>
  );
}

/* The hibi mark as a landscape: the sun is the dot, sitting just above a
   calm horizon, and its light on the water bends into the smile. Drawn,
   not photographed, so it's tiny and stays sharp at any size. */
function DuskScene() {
  return (
    <svg
      className="absolute inset-0 -z-10 size-full"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101b25" />
          <stop offset="0.5" stopColor="#22364a" />
          <stop offset="0.8" stopColor="#4d6273" />
          <stop offset="0.93" stopColor="#957d70" />
          <stop offset="1" stopColor="#e6ab84" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4752" />
          <stop offset="1" stopColor="#0c141b" />
        </linearGradient>
        <linearGradient id="column" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd2aa" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd2aa" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow">
          <stop offset="0" stopColor="#ffd8b4" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#f3a77a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f3a77a" stopOpacity="0" />
        </radialGradient>
        <filter id="soft" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="haze" x="-10%" y="-200%" width="120%" height="500%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <rect width="1600" height="822" fill="url(#sky)" />
      {/* thin warm clouds low on the right */}
      <g fill="#e9a37c" filter="url(#haze)">
        <ellipse cx="1330" cy="738" rx="210" ry="5" opacity="0.5" />
        <ellipse cx="1420" cy="762" rx="160" ry="4" opacity="0.45" />
        <ellipse cx="1240" cy="784" rx="240" ry="4" opacity="0.35" />
        <ellipse cx="300" cy="776" rx="180" ry="3" opacity="0.25" />
      </g>

      <circle cx="800" cy="790" r="300" fill="url(#glow)" />
      <rect y="820" width="1600" height="180" fill="url(#sea)" />
      <circle cx="800" cy="796" r="22" fill="#fff1df" />

      {/* the reflection: a light column, then the smile on the water */}
      <rect x="790" y="822" width="20" height="90" fill="url(#column)" filter="url(#soft)" />
      <path
        d="M690 872 A160 160 0 0 0 910 872"
        fill="none"
        stroke="#ffcfa3"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.45"
        filter="url(#soft)"
      />
      <line x1="0" y1="821" x2="1600" y2="821" stroke="#f6c19b" strokeOpacity="0.35" />
    </svg>
  );
}
