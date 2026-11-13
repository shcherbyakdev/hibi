import { cn } from "@/lib/utils";

/* hibi (日々, "day after day"). Minimal treatment after "dose" (logosystem.co):
   monochrome, the symbol sized to the letters, a clean geometric lowercase
   wordmark at medium weight — no tile, no colour. The mark is redrawn as SVG
   from the brand artwork, in its own coordinates (measured off the 1774×887
   source): a dot over a round-capped smile. currentColor throughout. */
export function HibiMark({ className, height }: { className?: string; height?: number }) {
  return (
    <svg viewBox="355 318 395 264" className={cn("w-auto shrink-0", className)} style={height ? { height } : undefined} aria-hidden>
      <circle cx="555" cy="384" r="60" fill="currentColor" />
      <path d="M397 445 A180.6 180.6 0 0 0 710 445" fill="none" stroke="currentColor" strokeWidth="79" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + wordmark. `size` is the wordmark's font size in px; the mark
    matches the x-height-to-ascender band and sits a third of an em away. */
export function HibiLogo({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span role="img" aria-label="hibi" className={cn("inline-flex items-center", className)} style={{ gap: size * 0.32 }}>
      <HibiMark height={Math.round(size * 0.62)} />
      <span aria-hidden className="leading-none font-medium tracking-[-0.045em]" style={{ fontSize: size }}>
        hibi
      </span>
    </span>
  );
}
