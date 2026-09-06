# Data model and import design

## Data model

The schema carries the product's learning loop and nothing beyond it.

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
| `legacy_imports` | Import audit and unsupported-field preservation | owner foreign key, checksum, timestamps, validated backup JSONB payload |

`ranges.legacy_payload` and the import audit record preserve valid fields that an
imported backup carries but the product does not surface (for example per-hand
overlays, combo selections, notes, tags, source, and spot/action records). That
is an explicit data-preservation boundary, not a commitment to build UI for those
fields.

Recording a drill is one database transaction: insert the session, update the
range totals and relevant hand aggregates, then advance the review schedule. A
failure rolls back the whole recording.

## Backup import and export

The backup file is a single JSON document, format version 1, holding a user's
ranges, practice stats, history, review schedules, and daily goal. The API both
writes it (`GET /exports/backup`) and reads it
(`POST /imports/legacy-backup/preview`, `POST /imports/legacy-backup`), so a
library can be moved between accounts and installations.

Importing is deliberately non-destructive:

1. Sign in, choose **Account → Import backup**, and submit a version 1 JSON
   backup file. Nothing is uploaded until the file is chosen.
2. Express validates the whole document before any database write, reports
   fields that are preserved but unsupported as warnings, and commits every
   supported record in one database transaction. A validation or persistence
   failure rolls back the entire import: there is no partially committed import.
3. The web app displays a clear success, partial-warning, or failure result;
   malformed input never silently replaces data.
4. The backup file itself is never modified, so it remains a recovery net.

The importer is idempotent through a user-scoped checksum/import record, so a
repeated upload cannot duplicate sessions or ranges. Conflict handling is
explicit: an initial import creates records; a later import requires a user
choice to merge or replace after a preview. No automatic background import
occurs.

## Seed data

Development seed data demonstrates the full library-to-practice-to-progress
flow. `screenshots/seed-backup.json` is a realistic version 1 backup fixture and
is accepted by the import test suite; it is not production user data.

## Non-goals

- No unrequested cloud sharing, public links, payments, solver integrations,
  postflop training, mixed frequencies, combo tooling, or AI features.
- No database access from browser code and no duplicated auth/business logic
  outside the Express API.
