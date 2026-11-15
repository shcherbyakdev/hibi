import Link from "next/link";
import { redirect } from "next/navigation";
import { Instrument_Serif } from "next/font/google";
import { ArrowRight } from "lucide-react";
import { HibiLogo } from "@/components/brand/hibi-logo";
import { getOptionalUser } from "@/lib/auth/session";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";
import { cn } from "@/lib/utils";

// The landing's display face only (the app keeps Geist): loaded here so
// no other page pays for it.
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

const MAC_DOWNLOAD = "https://github.com/shcherbyakdev/hibi/releases/latest";

// Staggered fade-up on load; nothing moves for reduced-motion visitors.
const rise = (delay: string) =>
  cn("motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-1000 motion-safe:ease-out", delay);

/** Hosted "/": one hero for visitors; signed-in people go straight to the
    planner. Always the dusk scene (light on dark) whatever the theme: it's
    a picture, not chrome. The CTA lands on today's plan; signed-out
    visitors pass through /login?next=/plan/day on the way. */
export default async function Home() {
  if (await getOptionalUser()) redirect(DEFAULT_AFTER_LOGIN);
  return (
    <main className="relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden bg-[#0e1821] text-white">
      <DuskScene />
      <header className={cn("mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6", rise(""))}>
        <HibiLogo size={20} />
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-full border border-white/20 bg-white/[0.04] px-4 text-[13px] font-medium text-white/90 backdrop-blur-sm transition-colors hover:border-white/35 hover:bg-white/10"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[9vh] pb-24 text-center">
        <p
          className={cn(
            "rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 font-mono text-[11px] tracking-[0.22em] text-white/70 uppercase backdrop-blur-sm",
            rise("motion-safe:delay-100"),
          )}
        >
          日々 · day after day
        </p>
        <h1
          className={cn(
            display.className,
            "mt-8 text-[clamp(3.4rem,9.5vw,7rem)] leading-[0.95] font-normal tracking-[-0.015em] text-balance",
            rise("motion-safe:delay-200"),
          )}
        >
          One good day, <em className="text-[#f6d2b5] italic">then the next.</em>
        </h1>
        <p className={cn("mt-7 max-w-md text-[16px] leading-relaxed text-pretty text-white/70", rise("motion-safe:delay-300"))}>
          A quiet planner for your tasks, goals and routines. Plan today, see the week, steer the month.
        </p>
        <div className={cn("mt-10 flex flex-wrap justify-center gap-3", rise("motion-safe:delay-500"))}>
          <Link
            href={DEFAULT_AFTER_LOGIN}
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-white pr-5 pl-6 text-[15px] font-medium text-[#0e1821] shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_8px_40px_-6px_rgba(246,170,120,0.6)] transition-[box-shadow,transform] duration-200 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.8),0_10px_50px_-4px_rgba(246,170,120,0.8)] active:scale-[0.98]"
          >
            Create your first task
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <a
            href={MAC_DOWNLOAD}
            className="inline-flex h-12 items-center rounded-full border border-white/20 bg-white/[0.04] px-6 text-[15px] font-medium text-white/90 backdrop-blur-sm transition-colors hover:border-white/35 hover:bg-white/10"
          >
            Download for Mac
          </a>
        </div>
        <p className={cn("mt-6 text-[13px] text-white/50", rise("motion-safe:delay-700"))}>
          The web app is invite-only for now.{" "}
          <Link href="/signup" className="text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white/70">
            Request access
          </Link>
        </p>
      </section>
    </main>
  );
}

/* The hibi mark as a landscape: the sun is the dot, sitting just above a
   calm horizon, and its light on the water bends into the smile. Drawn,
   not photographed, so it's tiny and stays sharp at any size. Film grain
   breaks up gradient banding; a vignette keeps the eye on the centre. */
function DuskScene() {
  return (
    <svg className="absolute inset-0 -z-10 size-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e1821" />
          <stop offset="0.5" stopColor="#21354a" />
          <stop offset="0.8" stopColor="#4b6072" />
          <stop offset="0.93" stopColor="#957d70" />
          <stop offset="1" stopColor="#e6ab84" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38454f" />
          <stop offset="1" stopColor="#0b1219" />
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
        <radialGradient id="vignette" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <filter id="soft" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="haze" x="-10%" y="-200%" width="120%" height="500%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      <rect width="1600" height="822" fill="url(#sky)" />
      <g fill="#e9a37c" filter="url(#haze)">
        <ellipse cx="1330" cy="738" rx="210" ry="5" opacity="0.5" />
        <ellipse cx="1420" cy="762" rx="160" ry="4" opacity="0.45" />
        <ellipse cx="1240" cy="784" rx="240" ry="4" opacity="0.35" />
        <ellipse cx="300" cy="776" rx="180" ry="3" opacity="0.25" />
      </g>

      <circle cx="800" cy="790" r="300" fill="url(#glow)" />
      <rect y="820" width="1600" height="180" fill="url(#sea)" />
      <circle cx="800" cy="796" r="22" fill="#fff1df" />

      <rect x="790" y="822" width="20" height="90" fill="url(#column)" filter="url(#soft)" />
      <path d="M690 872 A160 160 0 0 0 910 872" fill="none" stroke="#ffcfa3" strokeWidth="8" strokeLinecap="round" opacity="0.45" filter="url(#soft)" />
      <line x1="0" y1="821" x2="1600" y2="821" stroke="#f6c19b" strokeOpacity="0.35" />

      <rect width="1600" height="1000" fill="url(#vignette)" />
      <rect width="1600" height="1000" filter="url(#grain)" opacity="0.07" style={{ mixBlendMode: "overlay" }} />
    </svg>
  );
}
