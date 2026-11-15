/** A minimal EventSource for Node tests (Node 24 keeps its own behind a
    flag): one GET, "open" once headers arrive, "message" per data line,
    reconnect after a drop. Enough for HttpTransport's hints. */
export class TestEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  private ctrl = new AbortController();
  constructor(private url: string, private fetchImpl: typeof fetch = fetch) {
    void this.run();
  }
  private async run() {
    while (!this.ctrl.signal.aborted) {
      try {
        const res = await this.fetchImpl(this.url, { signal: this.ctrl.signal, headers: { accept: "text/event-stream" } });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        this.onopen?.();
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const event = buf.slice(0, i);
            buf = buf.slice(i + 2);
            for (const line of event.split("\n")) if (line.startsWith("data:")) this.onmessage?.({ data: line.slice(5).trim() });
          }
        }
      } catch {
        if (this.ctrl.signal.aborted) return;
        this.onerror?.();
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  close() {
    this.ctrl.abort();
  }
}
