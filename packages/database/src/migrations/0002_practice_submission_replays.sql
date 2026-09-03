create table practice_submission_replays (
  user_id uuid not null,
  range_id uuid not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  session_id uuid not null,
  response_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint practice_replays_pkey primary key (user_id, idempotency_key),
  constraint practice_replays_session_unique unique (session_id),
  constraint practice_replays_session_owner_range_fk
    foreign key (session_id, user_id, range_id)
    references practice_sessions(id, user_id, range_id) on delete cascade,
  constraint practice_replays_fingerprint_sha256 check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint practice_replays_snapshot_object check (jsonb_typeof(response_snapshot) = 'object')
);
