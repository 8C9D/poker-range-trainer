create type game_type as enum ('cash', 'tournament', 'sitAndGo');
create type table_size as enum ('headsUp', 'sixMax', 'nineMax');
create type range_position as enum ('utg', 'hj', 'co', 'btn', 'sb', 'bb');
create type scenario_action as enum ('open', 'call', 'threeBet', 'fourBet', 'defend', 'jam', 'callJam');
create type hand_category as enum ('pair', 'suited', 'offsuit');
create type practice_mode as enum ('recognition', 'build', 'timed', 'weakness', 'edges', 'mistakes');
create type legacy_import_status as enum ('pending', 'completed', 'failed');

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_normalized check (
    email = lower(email) and email = trim(email) and length(email) between 1 and 254
  ),
  constraint users_password_hash_bounded check (length(password_hash) between 20 and 255)
);
create unique index users_email_lower_unique on users (lower(email));

create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  csrf_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint auth_sessions_token_hash_sha256 check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint auth_sessions_csrf_hash_sha256 check (csrf_token_hash ~ '^[0-9a-f]{64}$'),
  constraint auth_sessions_expiry_after_creation check (expires_at > created_at),
  constraint auth_sessions_revocation_after_creation check (revoked_at is null or revoked_at >= created_at)
);
create index auth_sessions_active_lookup on auth_sessions (token_hash, expires_at);
create index auth_sessions_user_expiry on auth_sessions (user_id, expires_at);

create table hand_classes (
  code text primary key,
  category hand_category not null,
  combo_count integer not null,
  matrix_order integer not null unique,
  constraint hand_classes_combo_count_valid check (combo_count in (4, 6, 12)),
  constraint hand_classes_matrix_order_valid check (matrix_order between 0 and 168)
);

create table legacy_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  backup_version integer not null,
  backup_sha256 text not null,
  source_name text,
  status legacy_import_status not null default 'pending',
  snapshot jsonb not null,
  outcome jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint legacy_imports_user_sha256_unique unique (user_id, backup_sha256),
  constraint legacy_imports_backup_version_current check (backup_version = 1),
  constraint legacy_imports_sha256_hex check (backup_sha256 ~ '^[0-9a-f]{64}$'),
  constraint legacy_imports_completion_matches_status check (
    (status = 'pending' and completed_at is null)
    or (status in ('completed', 'failed') and completed_at is not null)
  )
);

create table ranges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  version integer not null default 1,
  display_order integer not null default 0,
  game_type game_type,
  table_size table_size,
  stack_depth_bb numeric(8, 2),
  "position" range_position,
  action_type scenario_action,
  versus_position range_position,
  notes text,
  archived boolean not null default false,
  favorite boolean not null default false,
  deleted_at timestamptz,
  legacy_range_id text,
  legacy_backup_version integer,
  legacy_payload jsonb,
  legacy_import_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ranges_user_fk foreign key (user_id) references users(id) on delete cascade,
  constraint ranges_legacy_import_fk foreign key (legacy_import_id)
    references legacy_imports(id) on delete set null,
  constraint ranges_id_user_unique unique (id, user_id),
  constraint ranges_name_normalized check (name = trim(name) and length(name) between 1 and 120),
  constraint ranges_version_positive check (version > 0),
  constraint ranges_display_order_nonnegative check (display_order >= 0),
  constraint ranges_legacy_backup_version_current check (legacy_backup_version is null or legacy_backup_version = 1),
  constraint ranges_stack_depth_valid check (stack_depth_bb is null or (stack_depth_bb > 0 and stack_depth_bb <= 10000)),
  constraint ranges_notes_normalized check (notes is null or (notes = trim(notes) and length(notes) <= 2000)),
  constraint ranges_legacy_range_id_bounded check (
    legacy_range_id is null or length(trim(legacy_range_id)) between 1 and 512
  )
);
create unique index ranges_owner_legacy_id_unique
  on ranges (user_id, legacy_range_id) where legacy_range_id is not null;
create index ranges_owner_active_updated_idx
  on ranges (user_id, updated_at) where deleted_at is null;
create index ranges_owner_active_order_idx
  on ranges (user_id, display_order) where deleted_at is null;
create index ranges_owner_active_library_filters_idx
  on ranges (user_id, archived, favorite, game_type, table_size, "position", versus_position, action_type)
  where deleted_at is null;

create table range_hands (
  range_id uuid not null,
  user_id uuid not null,
  hand_code text not null references hand_classes(code) on delete restrict,
  constraint range_hands_pkey primary key (range_id, hand_code),
  constraint range_hands_range_owner_fk foreign key (range_id, user_id)
    references ranges(id, user_id) on delete cascade
);
create index range_hands_owner_hand_idx on range_hands (user_id, hand_code);

create table practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  range_id uuid not null,
  mode practice_mode not null default 'recognition',
  idempotency_key uuid not null,
  total_questions integer not null,
  correct_answers integer not null,
  completed_at timestamptz not null,
  legacy_fingerprint text,
  created_at timestamptz not null default now(),
  constraint practice_sessions_range_owner_fk foreign key (range_id, user_id)
    references ranges(id, user_id) on delete cascade,
  constraint practice_sessions_id_owner_range_unique unique (id, user_id, range_id),
  constraint practice_sessions_owner_idempotency_key_unique unique (user_id, idempotency_key),
  constraint practice_sessions_total_positive check (total_questions > 0),
  constraint practice_sessions_correct_valid check (correct_answers between 0 and total_questions)
);
create unique index practice_sessions_legacy_fingerprint_unique
  on practice_sessions (user_id, legacy_fingerprint) where legacy_fingerprint is not null;
create index practice_sessions_owner_completed_idx on practice_sessions (user_id, completed_at);
create index practice_sessions_range_completed_idx on practice_sessions (range_id, completed_at);

create table practice_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  range_id uuid not null,
  question_id uuid not null,
  hand_code text not null references hand_classes(code) on delete restrict,
  expected_in_range boolean not null,
  user_answered_in_range boolean not null,
  correct boolean not null,
  answered_at timestamptz not null,
  constraint practice_attempts_session_owner_range_fk foreign key (session_id, user_id, range_id)
    references practice_sessions(id, user_id, range_id) on delete cascade,
  constraint practice_attempts_session_question_unique unique (session_id, question_id),
  constraint practice_attempts_correct_matches_answer
    check (correct = (expected_in_range = user_answered_in_range))
);
create index practice_attempts_session_idx on practice_attempts (session_id, answered_at);

create table range_practice_stats (
  range_id uuid not null,
  user_id uuid not null,
  total_attempts integer not null default 0,
  correct_attempts integer not null default 0,
  last_practiced_at timestamptz,
  constraint range_practice_stats_pkey primary key (range_id, user_id),
  constraint range_practice_stats_range_owner_fk foreign key (range_id, user_id)
    references ranges(id, user_id) on delete cascade,
  constraint range_practice_stats_total_nonnegative check (total_attempts >= 0),
  constraint range_practice_stats_correct_valid check (correct_attempts between 0 and total_attempts),
  constraint range_practice_stats_last_practiced_matches_attempts check (
    (total_attempts = 0 and correct_attempts = 0 and last_practiced_at is null)
    or (total_attempts > 0 and last_practiced_at is not null)
  )
);

create table range_hand_accuracy (
  range_id uuid not null,
  user_id uuid not null,
  hand_code text not null references hand_classes(code) on delete restrict,
  attempts integer not null,
  correct integer not null,
  false_positives integer not null,
  false_negatives integer not null,
  constraint range_hand_accuracy_pkey primary key (range_id, hand_code),
  constraint range_hand_accuracy_range_owner_fk foreign key (range_id, user_id)
    references ranges(id, user_id) on delete cascade,
  constraint range_hand_accuracy_attempts_nonnegative check (attempts >= 0),
  constraint range_hand_accuracy_correct_valid check (correct between 0 and attempts),
  constraint range_hand_accuracy_fp_nonnegative check (false_positives >= 0),
  constraint range_hand_accuracy_fn_nonnegative check (false_negatives >= 0),
  constraint range_hand_accuracy_error_invariant
    check (false_positives + false_negatives = attempts - correct)
);
create index range_hand_accuracy_owner_hand_idx on range_hand_accuracy (user_id, hand_code);

create table review_states (
  range_id uuid not null,
  user_id uuid not null,
  ease numeric(5, 2) not null,
  interval_days integer not null,
  due_at timestamptz,
  last_reviewed_at timestamptz,
  constraint review_states_pkey primary key (range_id, user_id),
  constraint review_states_range_owner_fk foreign key (range_id, user_id)
    references ranges(id, user_id) on delete cascade,
  constraint review_states_ease_minimum check (ease >= 1.3),
  constraint review_states_interval_nonnegative check (interval_days >= 0),
  constraint review_states_schedule_valid check (
    (interval_days = 0 and due_at is null and last_reviewed_at is null)
    or (interval_days > 0 and due_at is not null and last_reviewed_at is not null and due_at >= last_reviewed_at)
  )
);
create index review_states_owner_due_idx on review_states (user_id, due_at);

create table user_training_goals (
  user_id uuid primary key references users(id) on delete cascade,
  daily_hand_goal integer not null,
  updated_at timestamptz not null default now(),
  constraint user_training_goals_supported_goal check (daily_hand_goal in (10, 20, 40, 80))
);
