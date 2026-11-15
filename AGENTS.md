<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Schema rules live in two places

The hosted database (Postgres, `src/db/schema/*.ts` + migrations) and the
desktop sync service (`desktop/syncsvc/rules.go`) enforce the same CHECKs,
NOT NULLs, defaults and FKs. A schema change touches both, plus the refusal
fixture in `src/lib/sync/transport.contract.ts` — CI runs that fixture
against both servers, so drift fails a test instead of shipping.
