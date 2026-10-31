-- The domain caps a review interval at 36,500 days and the read contract refuses
-- anything longer, so an older import above that broke every read of its range.
update review_states set interval_days = 36500 where interval_days > 36500;

alter table review_states
  add constraint review_states_interval_ceiling check (interval_days <= 36500);

-- The hourly purge of dead sessions looks them up by expiry across all owners.
create index auth_sessions_expiry on auth_sessions (expires_at);
