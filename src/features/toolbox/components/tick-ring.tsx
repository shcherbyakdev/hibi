const TICKS = 60;
const SIZE = 200;
const INSET = 8; // ticks sit inside the box edge
const R = 40; // corner radius of the tick path
const LEN = 9; // tick length, pointing inward

/** Point and inward normal at fraction `t` (0 = top centre, clockwise) along
    a rounded square. */
function along(t: number): { x: number; y: number; nx: number; ny: number } {
  const lo = INSET, hi = SIZE - INSET, side = hi - lo - 2 * R, arc = (Math.PI / 2) * R;
  // Clockwise from top centre: straights (dx,dy = direction) and corner arcs.
  const segs: Array<{ len: number; at: (d: number) => { x: number; y: number; nx: number; ny: number } }> = [];
  const straight = (len: number, x0: number, y0: number, dx: number, dy: number) =>
    segs.push({ len, at: (d) => ({ x: x0 + dx * d, y: y0 + dy * d, nx: -dy, ny: dx }) });
  const corner = (cx: number, cy: number, a0: number) =>
    segs.push({ len: arc, at: (d) => { const a = a0 + d / R; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), nx: -Math.cos(a), ny: -Math.sin(a) }; } });
  straight(side / 2, SIZE / 2, lo, 1, 0);
  corner(hi - R, lo + R, -Math.PI / 2);
  straight(side, hi, lo + R, 0, 1);
  corner(hi - R, hi - R, 0);
  straight(side, hi - R, hi, -1, 0);
  corner(lo + R, hi - R, Math.PI / 2);
  straight(side, lo, hi - R, 0, -1);
  corner(lo + R, lo + R, Math.PI);
  straight(side / 2, lo + R, lo, 1, 0);
  let d = t * segs.reduce((s, g) => s + g.len, 0);
  for (const g of segs) {
    if (d <= g.len) return g.at(d);
    d -= g.len;
  }
  return segs[0].at(0);
}

const TICK_PATHS = Array.from({ length: TICKS }, (_, i) => {
  const p = along(i / TICKS);
  return `M${p.x.toFixed(2)} ${p.y.toFixed(2)}L${(p.x + p.nx * LEN).toFixed(2)} ${(p.y + p.ny * LEN).toFixed(2)}`;
});

/** 60 ticks around a rounded square; the first round(fraction·60) are lit,
    clockwise from the top. Content sits in the middle. */
export function TickRing({ fraction, children }: { fraction: number; children: React.ReactNode }) {
  const lit = Math.round(Math.min(1, Math.max(0, fraction)) * TICKS);
  return (
    <div className="relative aspect-square w-full">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full" aria-hidden>
        {TICK_PATHS.map((d, i) => (
          <path key={i} d={d} strokeWidth={2} strokeLinecap="round" className={i < lit ? "stroke-brand" : "stroke-foreground/15"} />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
