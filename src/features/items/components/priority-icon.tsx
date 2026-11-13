import { cn } from "@/lib/utils";

/** Index = priority value: 0 none, 1 urgent … 4 low (Linear's order). */
export const PRIORITY_LABELS = ["None", "Urgent", "High", "Medium", "Low"] as const;

/* Linear-style: urgent is a filled square with "!", the rest are three bars
   with 3/2/1 lit. Nothing for "none" — the row stays quiet. */
export function PriorityIcon({ priority, className }: { priority: number; className?: string }) {
  if (!priority) return null;
  const label = `${PRIORITY_LABELS[priority]} priority`;
  if (priority === 1)
    return (
      <svg viewBox="0 0 14 14" role="img" aria-label={label} className={cn("text-danger size-3.5 shrink-0", className)}>
        <rect width="14" height="14" rx="3" fill="currentColor" />
        <path d="M7 3.5v4.5M7 10.2v.3" stroke="var(--background)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  const lit = 5 - priority; // high 3, medium 2, low 1
  return (
    <svg viewBox="0 0 14 14" role="img" aria-label={label} className={cn("text-foreground size-3.5 shrink-0", className)}>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1.5 + i * 4.25} y={9 - i * 3} width="2.75" height={4 + i * 3} rx="1" fill="currentColor" opacity={i < lit ? 0.85 : 0.2} />
      ))}
    </svg>
  );
}
