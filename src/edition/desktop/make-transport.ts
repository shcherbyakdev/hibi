import { createHttpTransport } from "@/lib/sync/http-transport";
import type { SyncTransport } from "@/lib/sync/transport";

/** Desktop edition: sync with the app's built-in service. Same origin, so
    relative URLs — nothing touches window at build-time prerender. */
export const makeTransport = (): SyncTransport => createHttpTransport("");
