# ADR 0001: Use PostgreSQL for the application database

- Status: Accepted
- Date: 2026-09-01

## Context

Poker Range Trainer is a multi-user web application, and its primary data is
relational: a user owns ranges; ranges own hand memberships, practice sessions,
review schedules, and derived accuracy records. The application filters and sorts
a user's library by scenario metadata and activity, and recording a completed
drill updates several related records.

## Decision

Use PostgreSQL as the system of record. Model the product data with normalized,
owner-scoped tables and database constraints. Use a small JSONB payload only to
preserve fields a backup file carries that the product does not surface, not as
the primary range or analytics model.

## Rationale

- Foreign keys and transactions protect a drill recording from partially updating
  its session, cumulative stats, per-hand accuracy, and review schedule.
- Unique and check constraints express the fixed poker vocabulary and prevent
  duplicate hand membership or invalid counters.
- The library's owner-scoped filters, sorts, and date queries map naturally to
  indexed SQL queries.
- PostgreSQL keeps backup/import operations auditable and reversible without
  adding an otherwise unnecessary database service.

## Consequences

The backend owns migrations and repository access; client code never connects to
the database. We accept the operational need for PostgreSQL locally and in
production, addressed with Docker-based local development and documented
migrations. NoSQL may be reconsidered only if a new feature has a demonstrated
document-shaped workload that cannot be served by PostgreSQL or JSONB.

See [architecture](../architecture/architecture.md) and
[data model and import design](../architecture/data-and-import.md).
