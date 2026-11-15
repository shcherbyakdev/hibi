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

  // The REST API takes inserts straight from the public anon key, skipping
  // the form's honeypot, so the database caps the list at 30 an hour.
  it("caps requests at 30 an hour, for everyone", async () => {
    const admin = adminClient();
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    // Local test database only: clear the hour, keeping this file's own row.
    await admin.from("access_requests").delete().gt("created_at", hourAgo).neq("email", email);
    const { count } = await admin.from("access_requests").select("*", { count: "exact", head: true }).gt("created_at", hourAgo);
    const cap = () => ({ email: `cap-${randomUUID()}@todo.local` });
    try {
      expect((await admin.from("access_requests").insert(Array.from({ length: 30 - (count ?? 0) }, cap))).error).toBeNull();
      expect((await anonClient().from("access_requests").insert(cap())).error?.code).toBe("54000");
    } finally {
      await admin.from("access_requests").delete().like("email", "cap-%");
    }
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
