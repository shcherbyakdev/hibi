"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { usePrefs } from "@/lib/prefs";
import { SEGMENTED_NAV_CLASS, segmentedItemClass } from "@/components/ui/segmented";
import { ShortcutList } from "@/components/shortcuts";

const noop = () => () => {};

export function Settings() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const prefs = usePrefs();
  const [weekStart, setWeekStart] = React.useState(prefs.weekStart);
  // next-themes only knows the theme on the client.
  const mounted = React.useSyncExternalStore(noop, () => true, () => false);

  const saveWeekStart = async (ws: 0 | 1) => {
    setWeekStart(ws);
    const { error } = await createClient().auth.updateUser({ data: { week_start: ws } });
    if (error) {
      setWeekStart(prefs.weekStart);
      toast.error("Couldn't save. Try again.");
      return;
    }
    router.refresh(); // the layout re-reads it from the account
  };

  // px-3: text on the same line as the Today / Inbox rows.
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-3">
      <Section title="Appearance">
        <Row label="Theme">
          <Choice
            label="Theme"
            value={mounted ? (theme ?? "system") : ""}
            options={[
              ["light", "Light"],
              ["dark", "Dark"],
              ["system", "System"],
            ]}
            onChange={setTheme}
          />
        </Row>
      </Section>
      <Section title="Planner">
        <Row label="Week starts on" hint="Saved to your account, so all your devices agree.">
          <Choice
            label="Week starts on"
            value={String(weekStart)}
            options={[
              ["1", "Monday"],
              ["0", "Sunday"],
            ]}
            onChange={(v) => void saveWeekStart(v === "0" ? 0 : 1)}
          />
        </Row>
      </Section>
      <Section title="Keyboard shortcuts">
        <ShortcutList />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-[13px]">{label}</div>
        {hint ? <div className="text-subtle text-xs">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className={SEGMENTED_NAV_CLASS}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} onClick={() => onChange(v)} className={segmentedItemClass(v === value)}>
          {l}
        </button>
      ))}
    </div>
  );
}
