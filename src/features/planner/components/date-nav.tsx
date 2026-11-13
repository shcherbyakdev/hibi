"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** ‹ Today › and the period's name. */
export function DateNav({ title, onPrev, onNext, onToday, isCurrent }: { title: string; onPrev: () => void; onNext: () => void; onToday: () => void; isCurrent: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Previous" title="Previous (←)" data-nav="prev" onClick={onPrev}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="sm" title="Today (T)" data-nav="today" onClick={onToday} disabled={isCurrent}>
          Today
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Next" title="Next (→)" data-nav="next" onClick={onNext}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
