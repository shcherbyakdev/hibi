import { createMemoryServer } from "./memory-transport";
import { describeTransportContract } from "./transport.contract";
import type { SyncRow } from "./transport";

export const memoryItem = (over: Partial<SyncRow> = {}): SyncRow => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: "Task", status: "todo", updated_at: now, synced_at: now, deleted_at: null, ...over };
};

describeTransportContract("memory", async () => {
  const server = createMemoryServer({
    refuse: (table, row) => (table === "items" && !row.title ? { code: "23514", message: "items_title_len" } : null),
  });
  return { a: server.transport(), b: server.transport(), newItem: () => memoryItem(), refusedItem: () => memoryItem({ title: "" }) };
});
