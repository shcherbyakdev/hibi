import { beforeAll } from "vitest";
import { createUser, signIn, type TestUser } from "@/test/supabase";
import { createSupabaseTransport } from "./supabase-transport";
import { describeTransportContract } from "./transport.contract";
import type { SyncRow } from "./transport";

let user: TestUser;
beforeAll(async () => {
  user = await createUser();
});

const item = (over: Partial<SyncRow> = {}): SyncRow => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), user_id: user.id, title: "Task", sort_key: "a0", updated_at: now, synced_at: now, ...over };
};

describeTransportContract("supabase", async () => ({
  a: createSupabaseTransport(await signIn(user), user.id),
  b: createSupabaseTransport(await signIn(user), user.id),
  newItem: () => item(),
  refusedItem: () => item({ title: "" }),
  refusals: { extra: { user_id: user.id } },
}));
