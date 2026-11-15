import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Download } from "lucide-react";
import { HibiLogo } from "@/components/brand/hibi-logo";
import { getOptionalUser } from "@/lib/auth/session";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";
import { cn } from "@/lib/utils";

// A stable asset name in every release (scripts/release-desktop.sh), so
// /latest/download/ always serves the newest dmg directly.
const MAC_DMG = "https://github.com/shcherbyakdev/hibi/releases/latest/download/hibi.dmg";

// Contrast on the #05080c ground: ink 18.6:1, body 10.4:1, muted 7.1:1.
const focus = "outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#05080c]";

// Staggered fade-up on load; nothing moves for reduced-motion visitors.
const rise = (delay = "") =>
  cn("motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-700 motion-safe:ease-out", delay);

/** Hosted "/": one hero for visitors; signed-in people go straight to the
    planner. Always dark whatever the theme (it's a scene, not chrome). The
    horizon is a band in the page flow, never behind the text, so nothing
    overlaps at any window height. */
export default async function Home() {
  if (await getOptionalUser()) redirect(DEFAULT_AFTER_LOGIN);
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[linear-gradient(to_bottom,#05080c_0%,#070c13_55%,#0b1520_100%)] text-[#f5f7fa]">
      <header className={cn("mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6", rise())}>
        <HibiLogo size={20} />
        <Link
          href="/login"
          className={cn("inline-flex h-10 items-center rounded-full border border-white/25 px-5 text-[15px] font-medium transition-colors hover:bg-white/10", focus)}
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className={cn("text-[15px] font-medium text-[#9aa6b2]", rise("motion-safe:delay-100"))}>日々 · day after day</p>
        <h1
          className={cn(
            "mt-5 text-[clamp(2.5rem,6.5vw,4.5rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance",
            rise("motion-safe:delay-150"),
          )}
        >
          One good day, then the next.
        </h1>
        <p className={cn("mt-6 max-w-xl text-lg leading-relaxed text-pretty text-[#b8c2cc]", rise("motion-safe:delay-200"))}>
          A quiet planner for your tasks, goals and routines. Plan today, see the week, steer the month.
        </p>
        <div className={cn("mt-10 flex flex-wrap justify-center gap-3", rise("motion-safe:delay-300"))}>
          <Link
            href={DEFAULT_AFTER_LOGIN}
            className={cn(
              "group inline-flex h-12 items-center gap-2 rounded-full bg-[#f5f7fa] pr-5 pl-6 text-base font-semibold text-[#05080c] transition-[background-color,transform] duration-150 hover:bg-white active:scale-[0.98]",
              focus,
            )}
          >
            Create your first task
            <ArrowRight className="size-[18px] transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <a
            href={MAC_DMG}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-full border border-white/25 px-6 text-base font-semibold transition-colors hover:bg-white/10",
              focus,
            )}
          >
            <Download className="size-[18px]" aria-hidden />
            Download for Mac
          </a>
        </div>
        <p className={cn("mt-6 text-[15px] text-[#9aa6b2]", rise("motion-safe:delay-500"))}>
          macOS 13 or later. The web app is invite-only for now:{" "}
          <Link href="/signup" className={cn("rounded-sm text-[#f5f7fa] underline underline-offset-4", focus)}>
            request access
          </Link>
          .
        </p>
      </section>

      <Horizon />
    </main>
  );
}

/* A minimal sunrise at the foot of the page: the sun climbs from behind
   an implied horizon (a glow line that fades at both ends) while the light
   around it warms, once, then rests. Reduced motion shows the risen state. */
function Horizon() {
  return (
    <svg className="h-[clamp(120px,22vh,220px)] w-full shrink-0" viewBox="0 0 1600 220" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <style>{`
        .sunrise-sun { animation: sunrise-rise 3.2s cubic-bezier(.2,.7,.2,1) .5s both; }
        .sunrise-glow { animation: sunrise-fade 3.6s ease-out .5s both; }
        .sunrise-line { animation: sunrise-fade 1.2s ease-out .2s both; } /* before the sun breaks it */
        @keyframes sunrise-rise { from { transform: translateY(70px); } to { transform: translateY(0); } }
        @keyframes sunrise-fade { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .sunrise-sun, .sunrise-glow, .sunrise-line { animation: none; }
        }
      `}</style>
      <defs>
        <radialGradient id="sunrise-halo" cx="0.5" cy="1" r="0.5">
          <stop offset="0" stopColor="#d88a5c" stopOpacity="0.55" />
          <stop offset="0.4" stopColor="#8a5238" stopOpacity="0.18" />
          <stop offset="1" stopColor="#8a5238" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sunrise-edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e3a77f" stopOpacity="0" />
          <stop offset="0.5" stopColor="#e3a77f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#e3a77f" stopOpacity="0" />
        </linearGradient>
        <clipPath id="sunrise-sky">
          <rect width="1600" height="170" />
        </clipPath>
        <filter id="sunrise-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <ellipse className="sunrise-glow" cx="800" cy="170" rx="720" ry="150" fill="url(#sunrise-halo)" />
      <g clipPath="url(#sunrise-sky)">
        <g className="sunrise-sun">
          <circle cx="800" cy="138" r="34" fill="#f3cba6" opacity="0.25" filter="url(#sunrise-blur)" />
          <circle cx="800" cy="138" r="16" fill="#f5d2b0" />
        </g>
      </g>
      <rect className="sunrise-line" x="300" y="169.5" width="1000" height="1" fill="url(#sunrise-edge)" />
    </svg>
  );
}
