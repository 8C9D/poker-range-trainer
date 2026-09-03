import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const gameTypeEnum = pgEnum('game_type', ['cash', 'tournament', 'sitAndGo'])
export const tableSizeEnum = pgEnum('table_size', ['headsUp', 'sixMax', 'nineMax'])
export const positionEnum = pgEnum('range_position', ['utg', 'hj', 'co', 'btn', 'sb', 'bb'])
export const scenarioActionEnum = pgEnum('scenario_action', [
  'open',
  'call',
  'threeBet',
  'fourBet',
  'defend',
  'jam',
  'callJam',
])
export const handCategoryEnum = pgEnum('hand_category', ['pair', 'suited', 'offsuit'])
export const practiceModeEnum = pgEnum('practice_mode', [
  'recognition',
  'build',
  'timed',
  'weakness',
  'edges',
  'mistakes',
])
export const legacyImportStatusEnum = pgEnum('legacy_import_status', [
  'pending',
  'completed',
  'failed',
])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`),
    check(
      'users_email_normalized',
      sql`${table.email} = lower(${table.email}) and ${table.email} = trim(${table.email})
        and length(${table.email}) between 1 and 254`,
    ),
    check('users_password_hash_bounded', sql`length(${table.passwordHash}) between 20 and 255`),
  ],
)

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    csrfTokenHash: text('csrf_token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('auth_sessions_token_hash_unique').on(table.tokenHash),
    index('auth_sessions_active_lookup').on(table.tokenHash, table.expiresAt),
    index('auth_sessions_user_expiry').on(table.userId, table.expiresAt),
    check('auth_sessions_token_hash_sha256', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check('auth_sessions_csrf_hash_sha256', sql`${table.csrfTokenHash} ~ '^[0-9a-f]{64}$'`),
    check('auth_sessions_expiry_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      'auth_sessions_revocation_after_creation',
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt}`,
    ),
  ],
)

export const handClasses = pgTable(
  'hand_classes',
  {
    code: text('code').primaryKey(),
    category: handCategoryEnum('category').notNull(),
    comboCount: integer('combo_count').notNull(),
    matrixOrder: integer('matrix_order').notNull().unique(),
  },
  (table) => [
    check('hand_classes_combo_count_valid', sql`${table.comboCount} in (4, 6, 12)`),
    check('hand_classes_matrix_order_valid', sql`${table.matrixOrder} between 0 and 168`),
  ],
)

export const legacyImports = pgTable(
  'legacy_imports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    backupVersion: integer('backup_version').notNull(),
    backupSha256: text('backup_sha256').notNull(),
    sourceName: text('source_name'),
    status: legacyImportStatusEnum('status').notNull().default('pending'),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    outcome: jsonb('outcome').$type<Record<string, unknown>>(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('legacy_imports_user_sha256_unique').on(table.userId, table.backupSha256),
    check('legacy_imports_backup_version_current', sql`${table.backupVersion} = 1`),
    check('legacy_imports_sha256_hex', sql`${table.backupSha256} ~ '^[0-9a-f]{64}$'`),
    check(
      'legacy_imports_completion_matches_status',
      sql`(${table.status} = 'pending' and ${table.completedAt} is null) or
        (${table.status} in ('completed', 'failed') and ${table.completedAt} is not null)`,
    ),
  ],
)

export const ranges = pgTable(
  'ranges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    version: integer('version').notNull().default(1),
    displayOrder: integer('display_order').notNull().default(0),
    gameType: gameTypeEnum('game_type'),
    tableSize: tableSizeEnum('table_size'),
    stackDepthBb: numeric('stack_depth_bb', { precision: 8, scale: 2 }),
    position: positionEnum('position'),
    actionType: scenarioActionEnum('action_type'),
    versusPosition: positionEnum('versus_position'),
    notes: text('notes'),
    archived: boolean('archived').notNull().default(false),
    favorite: boolean('favorite').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    legacyRangeId: text('legacy_range_id'),
    legacyBackupVersion: integer('legacy_backup_version'),
    legacyPayload: jsonb('legacy_payload').$type<Record<string, unknown>>(),
    legacyImportId: uuid('legacy_import_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'ranges_user_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.legacyImportId],
      foreignColumns: [legacyImports.id],
      name: 'ranges_legacy_import_fk',
    }).onDelete('set null'),
    unique('ranges_id_user_unique').on(table.id, table.userId),
    uniqueIndex('ranges_owner_legacy_id_unique')
      .on(table.userId, table.legacyRangeId)
      .where(sql`${table.legacyRangeId} is not null`),
    index('ranges_owner_active_updated_idx')
      .on(table.userId, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    index('ranges_owner_active_order_idx')
      .on(table.userId, table.displayOrder)
      .where(sql`${table.deletedAt} is null`),
    index('ranges_owner_active_library_filters_idx')
      .on(
        table.userId,
        table.archived,
        table.favorite,
        table.gameType,
        table.tableSize,
        table.position,
        table.versusPosition,
        table.actionType,
      )
      .where(sql`${table.deletedAt} is null`),
    check(
      'ranges_name_normalized',
      sql`${table.name} = trim(${table.name}) and length(${table.name}) between 1 and 120`,
    ),
    check('ranges_version_positive', sql`${table.version} > 0`),
    check('ranges_display_order_nonnegative', sql`${table.displayOrder} >= 0`),
    check(
      'ranges_legacy_backup_version_current',
      sql`${table.legacyBackupVersion} is null or ${table.legacyBackupVersion} = 1`,
    ),
    check(
      'ranges_stack_depth_valid',
      sql`${table.stackDepthBb} is null or (${table.stackDepthBb} > 0 and ${table.stackDepthBb} <= 10000)`,
    ),
    check(
      'ranges_notes_normalized',
      sql`${table.notes} is null or (${table.notes} = trim(${table.notes}) and length(${table.notes}) <= 2000)`,
    ),
    check(
      'ranges_legacy_range_id_bounded',
      sql`${table.legacyRangeId} is null or length(trim(${table.legacyRangeId})) between 1 and 512`,
    ),
  ],
)

export const rangeHands = pgTable(
  'range_hands',
  {
    rangeId: uuid('range_id').notNull(),
    userId: uuid('user_id').notNull(),
    handCode: text('hand_code')
      .notNull()
      .references(() => handClasses.code, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.rangeId, table.handCode], name: 'range_hands_pkey' }),
    foreignKey({
      columns: [table.rangeId, table.userId],
      foreignColumns: [ranges.id, ranges.userId],
      name: 'range_hands_range_owner_fk',
    }).onDelete('cascade'),
    index('range_hands_owner_hand_idx').on(table.userId, table.handCode),
  ],
)

export const practiceSessions = pgTable(
  'practice_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    rangeId: uuid('range_id').notNull(),
    mode: practiceModeEnum('mode').notNull().default('recognition'),
    idempotencyKey: uuid('idempotency_key').notNull(),
    totalQuestions: integer('total_questions').notNull(),
    correctAnswers: integer('correct_answers').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    legacyFingerprint: text('legacy_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.rangeId, table.userId],
      foreignColumns: [ranges.id, ranges.userId],
      name: 'practice_sessions_range_owner_fk',
    }).onDelete('cascade'),
    unique('practice_sessions_id_owner_range_unique').on(table.id, table.userId, table.rangeId),
    unique('practice_sessions_owner_idempotency_key_unique').on(table.userId, table.idempotencyKey),
    uniqueIndex('practice_sessions_legacy_fingerprint_unique')
      .on(table.userId, table.legacyFingerprint)
      .where(sql`${table.legacyFingerprint} is not null`),
    index('practice_sessions_owner_completed_idx').on(table.userId, table.completedAt),
    index('practice_sessions_range_completed_idx').on(table.rangeId, table.completedAt),
    check('practice_sessions_total_positive', sql`${table.totalQuestions} > 0`),
    check(
      'practice_sessions_correct_valid',
      sql`${table.correctAnswers} between 0 and ${table.totalQuestions}`,
    ),
  ],
)

/** Immutable idempotency ledger for practice submissions; response data is replayed verbatim. */
export const practiceSubmissionReplays = pgTable(
  'practice_submission_replays',
  {
    userId: uuid('user_id').notNull(),
    rangeId: uuid('range_id').notNull(),
    idempotencyKey: uuid('idempotency_key').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    sessionId: uuid('session_id').notNull(),
    responseSnapshot: jsonb('response_snapshot').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.idempotencyKey], name: 'practice_replays_pkey' }),
    unique('practice_replays_session_unique').on(table.sessionId),
    foreignKey({
      columns: [table.sessionId, table.userId, table.rangeId],
      foreignColumns: [practiceSessions.id, practiceSessions.userId, practiceSessions.rangeId],
      name: 'practice_replays_session_owner_range_fk',
    }).onDelete('cascade'),
    check(
      'practice_replays_fingerprint_sha256',
      sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    check('practice_replays_snapshot_object', sql`jsonb_typeof(${table.responseSnapshot}) = 'object'`),
  ],
)

export const practiceAttempts = pgTable(
  'practice_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id').notNull(),
    userId: uuid('user_id').notNull(),
    rangeId: uuid('range_id').notNull(),
    questionId: uuid('question_id').notNull(),
    handCode: text('hand_code')
      .notNull()
      .references(() => handClasses.code, { onDelete: 'restrict' }),
    expectedInRange: boolean('expected_in_range').notNull(),
    userAnsweredInRange: boolean('user_answered_in_range').notNull(),
    correct: boolean('correct').notNull(),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.sessionId, table.userId, table.rangeId],
      foreignColumns: [practiceSessions.id, practiceSessions.userId, practiceSessions.rangeId],
      name: 'practice_attempts_session_owner_range_fk',
    }).onDelete('cascade'),
    unique('practice_attempts_session_question_unique').on(table.sessionId, table.questionId),
    index('practice_attempts_session_idx').on(table.sessionId, table.answeredAt),
    check(
      'practice_attempts_correct_matches_answer',
      sql`${table.correct} = (${table.expectedInRange} = ${table.userAnsweredInRange})`,
    ),
  ],
)

export const rangePracticeStats = pgTable(
  'range_practice_stats',
  {
    rangeId: uuid('range_id').notNull(),
    userId: uuid('user_id').notNull(),
    totalAttempts: integer('total_attempts').notNull().default(0),
    correctAttempts: integer('correct_attempts').notNull().default(0),
    lastPracticedAt: timestamp('last_practiced_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.rangeId, table.userId], name: 'range_practice_stats_pkey' }),
    foreignKey({
      columns: [table.rangeId, table.userId],
      foreignColumns: [ranges.id, ranges.userId],
      name: 'range_practice_stats_range_owner_fk',
    }).onDelete('cascade'),
    check('range_practice_stats_total_nonnegative', sql`${table.totalAttempts} >= 0`),
    check(
      'range_practice_stats_correct_valid',
      sql`${table.correctAttempts} between 0 and ${table.totalAttempts}`,
    ),
    check(
      'range_practice_stats_last_practiced_matches_attempts',
      sql`(${table.totalAttempts} = 0 and ${table.correctAttempts} = 0 and ${table.lastPracticedAt} is null)
        or (${table.totalAttempts} > 0 and ${table.lastPracticedAt} is not null)`,
    ),
  ],
)

export const rangeHandAccuracy = pgTable(
  'range_hand_accuracy',
  {
    rangeId: uuid('range_id').notNull(),
    userId: uuid('user_id').notNull(),
    handCode: text('hand_code')
      .notNull()
      .references(() => handClasses.code, { onDelete: 'restrict' }),
    attempts: integer('attempts').notNull(),
    correct: integer('correct').notNull(),
    falsePositives: integer('false_positives').notNull(),
    falseNegatives: integer('false_negatives').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.rangeId, table.handCode], name: 'range_hand_accuracy_pkey' }),
    foreignKey({
      columns: [table.rangeId, table.userId],
      foreignColumns: [ranges.id, ranges.userId],
      name: 'range_hand_accuracy_range_owner_fk',
    }).onDelete('cascade'),
    index('range_hand_accuracy_owner_hand_idx').on(table.userId, table.handCode),
    check('range_hand_accuracy_attempts_nonnegative', sql`${table.attempts} >= 0`),
    check(
      'range_hand_accuracy_correct_valid',
      sql`${table.correct} between 0 and ${table.attempts}`,
    ),
    check('range_hand_accuracy_fp_nonnegative', sql`${table.falsePositives} >= 0`),
    check('range_hand_accuracy_fn_nonnegative', sql`${table.falseNegatives} >= 0`),
    check(
      'range_hand_accuracy_error_invariant',
      sql`${table.falsePositives} + ${table.falseNegatives} = ${table.attempts} - ${table.correct}`,
    ),
  ],
)

export const reviewStates = pgTable(
  'review_states',
  {
    rangeId: uuid('range_id').notNull(),
    userId: uuid('user_id').notNull(),
    ease: numeric('ease', { precision: 5, scale: 2 }).notNull(),
    intervalDays: integer('interval_days').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.rangeId, table.userId], name: 'review_states_pkey' }),
    foreignKey({
      columns: [table.rangeId, table.userId],
      foreignColumns: [ranges.id, ranges.userId],
      name: 'review_states_range_owner_fk',
    }).onDelete('cascade'),
    index('review_states_owner_due_idx').on(table.userId, table.dueAt),
    check('review_states_ease_minimum', sql`${table.ease} >= 1.3`),
    check('review_states_interval_nonnegative', sql`${table.intervalDays} >= 0`),
    check(
      'review_states_schedule_valid',
      sql`(
        ${table.intervalDays} = 0 and ${table.dueAt} is null and ${table.lastReviewedAt} is null
      ) or (
        ${table.intervalDays} > 0 and ${table.dueAt} is not null and ${table.lastReviewedAt} is not null
        and ${table.dueAt} >= ${table.lastReviewedAt}
      )`,
    ),
  ],
)

export const userTrainingGoals = pgTable(
  'user_training_goals',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    dailyHandGoal: integer('daily_hand_goal').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'user_training_goals_daily_hand_goal_valid',
      sql`${table.dailyHandGoal} between 1 and 1000000000`,
    ),
  ],
)
