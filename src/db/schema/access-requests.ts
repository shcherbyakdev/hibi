import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Temporary "request access" list while sign-up is closed: anyone may add
// an email (anon INSERT only, see the migration); nobody can read it through
// the API. The owner reads it in the Supabase dashboard and creates accounts
// by hand. Not synced to clients.
export const accessRequests = pgTable(
  "access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [check("access_requests_email_shape", sql`char_length(${t.email}) <= 254 and ${t.email} ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`)],
);
