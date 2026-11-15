import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let binary: string | null = null;

/** Builds (once per run) and starts the desktop's Go sync service on a free
    loopback port with a fresh SQLite file. */
export async function startGoSync(): Promise<{ url: string; stop: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), "hibi-sync-"));
  if (!binary) {
    binary = join(dir, "hibi-sync");
    execFileSync("go", ["build", "-o", binary, "./cmd/hibi-sync"], { cwd: join(process.cwd(), "desktop"), stdio: "inherit" });
  }
  const child = spawn(binary, ["-port", "0", "-db", join(dir, "hibi.sqlite")], { stdio: ["ignore", "pipe", "inherit"] });
  const url = await new Promise<string>((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (b: Buffer) => {
      out += b.toString();
      const m = /listening on (127\.0\.0\.1:\d+)/.exec(out);
      if (m) resolve(`http://${m[1]}`);
    });
    child.on("exit", (code) => reject(new Error(`hibi-sync exited ${code}`)));
  });
  return { url, stop: () => child.kill() };
}
