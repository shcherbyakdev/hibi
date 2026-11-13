const find = () => document.querySelector<HTMLInputElement>("[data-quick-add]");

/** Polls for a quick-add field for up to `ms`. */
async function waitForField(ms: number): Promise<HTMLInputElement | null> {
  for (let t = 0; t <= ms; t += 50) {
    const el = find();
    if (el) return el;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

/** Focus the page's quick-add field; if the page has none, go to the Inbox
    and focus its capture field. Used by C and ⌘K. The short first wait
    covers a page that is still rendering (C pressed right after 1/2/3). */
export async function focusQuickAdd(push: (href: string) => void) {
  const here = await waitForField(300);
  if (here) return here.focus();
  push("/inbox");
  (await waitForField(2000))?.focus();
}
