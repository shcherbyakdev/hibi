import type { SyncedTable } from "./db";
import { TransientError, type PullFrom, type RowError, type SyncRow, type SyncTransport } from "./transport";

type Options = {
  /** Injected in tests to cut the network; the browser's by default. */
  fetch?: typeof fetch;
  /** Node 24 keeps EventSource behind a flag; tests pass a stand-in. */
  EventSource?: (url: string) => EventSource;
};

/** The desktop edition's transport: the built-in sync service (desktop/
    syncsvc, Go) over HTTP on the same origin. 409 = the service refused a
    row (RowError); any other failure is transient. Hints come over SSE. */
export function createHttpTransport(baseUrl: string, opts: Options = {}): SyncTransport {
  const f = opts.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const openEvents = opts.EventSource ?? ((url: string) => new EventSource(url));
  const url = (path: string) => `${baseUrl}${path}`;

  async function request(path: string, init?: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await f(url(path), init);
    } catch (e) {
      throw new TransientError(e instanceof Error ? e.message : String(e));
    }
    return res;
  }

  async function ok(res: Response): Promise<Response> {
    if (!res.ok) throw new TransientError(`${res.status} ${await res.text().catch(() => "")}`.trim());
    return res;
  }

  return {
    async upsert(table: SyncedTable, rows: SyncRow[]) {
      const res = await request(`/sync/${table}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rows) });
      if (res.status === 409) return (await res.json()) as RowError;
      await ok(res);
      return null;
    },

    async get(table: SyncedTable, id: string) {
      const res = await request(`/sync/${table}/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      return (await (await ok(res)).json()) as SyncRow;
    },

    async pull(table: SyncedTable, from: PullFrom, limit: number) {
      const q = new URLSearchParams({ limit: String(limit) });
      if ("since" in from) q.set("since", from.since);
      else {
        q.set("after_synced_at", from.after.synced_at);
        q.set("after_id", from.after.id);
      }
      return (await (await ok(await request(`/sync/${table}?${q}`))).json()) as SyncRow[];
    },

    subscribe(onChange, onReady) {
      // EventSource reconnects on its own; every (re)open is "ready".
      const source = openEvents(url("/sync/events"));
      source.onopen = () => onReady();
      source.onmessage = () => onChange();
      return () => source.close();
    },
  };
}
