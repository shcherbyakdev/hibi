import { headers } from "next/headers";

/** This request's CSP nonce (src/proxy.hosted.ts), for inline scripts the
    app renders itself (next-themes). Reading headers makes every hosted
    page dynamic, which per-request nonces require anyway. */
export async function getNonce(): Promise<string | undefined> {
  return (await headers()).get("x-nonce") ?? undefined;
}
