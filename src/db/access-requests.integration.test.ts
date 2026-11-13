import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, signedInUser } from "@/test/supabase";

const email = `req-${randomUUID()}@todo.local`;

describe("access_requests", () => {
  afterAll(async () => {
    await adminClient().from("access_requests").delete().eq("email", email);
  });

  it("lets anyone add an email, once", async () => {
    const anon = anonClient();
    expect((await anon.from("access_requests").insert({ email })).error).toBeNull();
    expect((await anon.from("access_requests").insert({ email })).error?.code).toBe("23505");
    expect((await anon.from("access_requests").insert({ email: "not-an-email" })).error).not.toBeNull();
  });

  it("never lets the API read, change or delete the list", async () => {
    const { client } = await signedInUser();
    for (const c of [anonClient(), client]) {
      const read = await c.from("access_requests").select("email");
      expect(read.data ?? []).toEqual([]);
      await c.from("access_requests").delete().eq("email", email);
      await c.from("access_requests").update({ email: "x@y.z" }).eq("email", email);
    }
    const { data } = await adminClient().from("access_requests").select("email").eq("email", email);
    expect(data).toEqual([{ email }]);
  });
});
