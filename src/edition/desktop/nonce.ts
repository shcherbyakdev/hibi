/** Desktop: a static export with no proxy, so no CSP nonce. */
export async function getNonce(): Promise<string | undefined> {
  return undefined;
}
