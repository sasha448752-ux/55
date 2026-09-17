# Order details: implementation checkpoint

Status: database schema deployed 2026-09-17 as add_order_details_and_status_history. Frontend changes remain local. Existing order count (1) and row checksum were identical before/after installation. No customer order was updated for testing.

Live read-only inspection confirmed private.is_admin() uses admin_users and orders SELECT allows owners or administrators. Therefore notes must not be columns on orders or mixed into customer-visible history.

## Prepared model

- order_internal_notes: administrators read/append, author must match auth.uid(); no client edits/deletes. Maximum 4000 characters.
- order_delivery: customers read only their own carrier/tracking number; administrators insert/update. No arbitrary tracking URLs.
- order_status_history: customers read their own history; no browser write grants. No internal commentary or employee identity in public history.
- Foreign keys preserve compatibility with existing order deletion via cascade. This is not a permanent compliance audit log.
- Existing rows, prices, guest checkout and permissions remain unchanged.

## Required before deployment

1. Atomic status-history trigger is drafted: private schema, fixed search_path, explicit authenticated admin check, no browser EXECUTE privilege, no swallowed exceptions. Unchanged status produces no event. System status writes are deliberately not allowed until separately designed. This still requires PostgreSQL execution tests.
2. Test anonymous, customer A, customer B and administrator access in an isolated database, including direct API writes, spoofed author, empty/oversized notes and deletion compatibility.
3. Prove status update/history insertion either both succeed or both roll back. No event for unchanged status. Do not invent old event dates.
4. Add admin forms and customer read-only fields, error handling and tests; do not expose internal notes to account.html.
5. Generate migration using Supabase tooling, check advisors, snapshot data and deploy additively. Rollback should disable new UI, not delete newly written notes/history.

The historical draft SQL ends in ROLLBACK for local testing. The MCP migration applied the same schema without the outer BEGIN/ROLLBACK. Do not reapply it. rollback-order-details.sql disables the status trigger and new writes without deleting tables or newly saved information.

## Local verification — 17.09.2026

Isolated PGlite 0.5.8 installed in ../database-tests, outside the published repository. order-details.mjs executes this draft with synthetic auth.users, auth.uid() and inspected ownership policy fixtures. All 23 assertions pass: owner/foreign isolation, anonymous denial, staff-only notes, spoofed author rejection, note length validation, no direct history writes, unchanged status, atomic rollback under forced history failure and deletion cascades. This is real local PostgreSQL execution, but not full Supabase/PostgREST integration verification.

Admin UI module and styles are connected locally to admin.html/admin.js. Twenty-five frontend assertions pass. Before publication, verify production API integration and note ID generation on the current HTTP origin. Full browser acceptance remains incomplete.

Post-deploy inspection: RLS enabled on all three new tables, no anonymous SELECT grants, no authenticated history INSERT grant. Security advisor reported no findings on new tables/functions. Existing chat/admin RLS informational notices and disabled leaked-password protection remain unchanged.
