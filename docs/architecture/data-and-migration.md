# Data model and migration design

## Active data model

The initial schema keeps the product's current learning loop without restoring
archived features.

| Table | Purpose | Important constraints and access pattern |
| --- | --- | --- |
| `users` | Account identity and password hash | unique normalized email; password hash only; never returned by APIs |
| `sessions` | Revocable browser sessions | hashed token identifier, expiry, user foreign key |
| `ranges` | User-owned named preflop charts and scenario metadata | owner foreign key; archive/favorite flags; soft-delete timestamp; indexed by owner plus updated/activity/filter fields |
| `range_hands` | Selected hand classes in a range | composite primary key `(range_id, hand_code)`; `hand_code` constrained to the 169 canonical classes |
| `practice_sessions` | Completed practice summaries | range and user foreign keys; non-negative counts; recorded timestamp |
| `range_practice_stats` | Fast per-range totals | one row per range; counters constrained to valid totals |
| `range_hand_accuracy` | Per-range hand accuracy and error directions | composite key `(range_id, hand_code)`; all counters constrained and mutually consistent |
| `range_reviews` | Spaced-repetition schedule | one row per range; valid ease/interval and due timestamp |
| `training_goals` | One daily-hands target per user | one row per user; target is zero or a supported positive value |
| `legacy_imports` | Import audit and unsupported-field preservation | owner foreign key, checksum, timestamps, validated legacy JSONB payload |

`ranges.legacy_payload` or a related import record preserves valid dormant fields
from old backups (for example per-hand overlays, combo selections, notes, tags,
source, and retired spot/action records) without exposing them as new product UI.
That is an explicit data-preservation boundary, not a commitment to restore those
features.

Recording a drill is one database transaction: insert the session, update the
range totals and relevant hand aggregates, then advance the review schedule. A
failure rolls back the whole recording.

## Import-first migration

Existing data is local under the `poker-range-trainer.*.v1` keys and is also
exportable as backup version 1. The safe migration path is intentionally
additive:

1. Leave the existing legacy (`src/`, `mobile/`) implementation and its local data untouched.
2. In the new app, authenticate, choose **Import existing backup**, and submit a
   JSON backup exported by the legacy app. A browser helper may offer a local
   snapshot, but it must ask before uploading anything.
3. Express validates the full legacy backup before a database write, reports
   unsupported-but-preserved fields as warnings, and commits every supported
   record in one database transaction. Validation or persistence failure rolls
   back the entire import: there is no partially committed import.
4. The frontend displays a clear success, partial-warning, or failure result;
   malformed input never silently replaces data.
5. The original local data and backup file remain untouched as a recovery net.

The importer is idempotent through a user-scoped checksum/import record, so a
repeated upload cannot duplicate sessions or ranges. Conflict handling is
explicit: an initial import creates records; a later import requires a user
choice to merge or replace after a preview. No automatic background migration
or deletion of legacy storage occurs.

## Seed data

Development seed data demonstrates the full library-to-practice-to-progress
flow. `screenshots/seed-backup.json` is a realistic legacy fixture and should be
accepted by the import test suite; it is not production user data.

## Non-goals

- No unrequested cloud sharing, public links, payments, solver integrations,
  postflop training, mixed frequencies, combo tooling, or AI features.
- No destructive conversion of the `mobile/` app, the local storage keys, or
  archived code until the import path and clean setup validation are complete.
- No database access from Next.js browser code and no duplicated auth/business
  logic in Next.js route handlers.
