# Resource reduction and WhatsApp shutdown

Project: `sukehkrhvasfnoheyvvx` (wala).

## Applied on production

- Disabled `mazbot-poll` cron and all enabled/auto-confirm/AI WhatsApp settings.
- Replaced the eight WhatsApp endpoints (including reminder processing and sharing) with no-op handlers. They acknowledge requests with `skipped: true`, perform no database operations and make no provider calls. Existing JWT gateway requirements were preserved.
- Removed the WhatsApp confirmation call from the live `create-order` bundle. Checkout, stock, city matching and push notification logic were preserved.
- Wrapped the existing email cron command with checks for visible messages in `pgmq.q_auth_emails` and `pgmq.q_transactional_emails`. Kept the 30-second schedule and existing authorization header. Verified the actual command and subsequent cron executions.
- Added daily pruning of completed cron run records older than seven days. Initial compaction retained the latest 100,000 run records (more than seven days at execution). This reduced cron storage from approximately 1,997 MB to 94 MB and database size from 2,274 MB to 371 MB, using decimal units. No customer/order table was truncated or deleted.
- Remote migration history: `reduce_idle_email_invocations_and_retain_cron_history`, followed by `fix_email_queue_guard_whitespace`.

## Landing images

`scripts/optimize-inline-images.cjs --apply` uploads embedded raster images to the existing product-images bucket. It preserves original image bytes, verifies SHA-256 after public retrieval, backs up each original description outside the repository, and updates each page only if its updated_at value still matches. It then reads the page back to verify the exact replacement. It does not modify customer/order data.

Set `WASLA_ACCESS_ENV` to the existing local project access env file before running. Credentials are never logged. Backups and per-page results live under the workspace's `output/supabase-resource-fix/landing-backups` directory. Keep them until the release is verified; do not commit these backups.

The editor now uploads new description images to Storage. The WhatsApp page shows a disabled notice, and confirmation controls no longer invoke WhatsApp or increment confirmation attempts through the manual WhatsApp action.

## Recovery

Original deployed WhatsApp/create-order function bundles are saved under `output/supabase-resource-fix/backups` outside this repository. Local prior code remains in Git history. Re-enabling WhatsApp requires an intentional restoration of functions, settings and schedule; do not merely toggle the UI.

For a description rollback, compare the current page revision before restoring a saved description so newer merchant edits are not overwritten. Uploaded images can remain in Storage safely.

## Verification scope

Verify no enabled WhatsApp settings, inactive MazBot cron, successful conditional email cron, preserved order/profile counts, no remaining embedded images in landing descriptions, matching uploaded bytes, and successful website build/deployment. Existing advisor warnings are not automatically actionable and were not addressed through blanket permission/index changes.
