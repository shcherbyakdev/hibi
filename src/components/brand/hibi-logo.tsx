import { cn } from "@/lib/utils";

/* hibi (日々, "day after day"). Minimal treatment after "dose" (logosystem.co):
   a light symbol sized to the letters and a clean geometric lowercase
   wordmark, no tile. The mark is the brand artwork redrawn in its own
   coordinates (measured off the 1774×887 source) at a lighter weight — dot
   r 44 and a 54-unit round-capped smile, down from 60 / 79 — so it sits
   with a medium-weight wordmark. Colour is the logo blue (`primary`, the
   same #4858fa in both themes); the wordmark is ink. */
const VIEWBOX = "366 336 375 231";
export const MARK_RATIO = 375 / 231;

export function HibiMark({ className, height }: { className?: string; height?: number }) {
  return (
    <svg viewBox={VIEWBOX} className={cn("text-primary w-auto shrink-0", className)} style={height ? { height } : undefined} aria-hidden>
      <circle cx="555" cy="384" r="44" fill="currentColor" />
      <path d="M397 445 A180.6 180.6 0 0 0 710 445" fill="none" stroke="currentColor" strokeWidth="54" strokeLinecap="round" />
    </svg>
  );
}

/** Outfit 500 (brand only): geometric, with round i-dots that echo the mark. */
export function HibiWordmark({ size, className }: { size: number; className?: string }) {
  return (
    <span aria-hidden className={cn("font-brand leading-none font-medium tracking-[-0.02em]", className)} style={{ fontSize: size }}>
      hibi
    </span>
  );
}

/** Mark + wordmark, for standalone use (auth pages). `size` = wordmark px. */
export function HibiLogo({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span role="img" aria-label="hibi" className={cn("inline-flex items-center", className)} style={{ gap: Math.round(size * 0.3) }}>
      <HibiMark height={Math.round(size * 0.64)} />
      <HibiWordmark size={size} />
    </span>
  );
}
