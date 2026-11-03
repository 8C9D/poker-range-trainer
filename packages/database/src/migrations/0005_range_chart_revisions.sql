-- A drill is dealt from the chart a range had when its page loaded, but it used to
-- be scored against the chart the range had when the drill was submitted. Editing
-- the chart in another tab mid-drill made the recorded result disagree with the
-- feedback the player saw. A range now remembers which of its versions introduced
-- its current chart, and the charts it replaced are kept for a while, so a
-- submission naming the version it was dealt from is scored against that chart.

-- The version at which the current chart took effect. Rows written before this
-- migration only promise that the chart has been current since their present
-- version; anything older is unknown, which scoring treats as "use the current".
-- The default keeps inserts from the previous release valid during a rollback.
alter table ranges add column chart_version integer not null default 1;
update ranges set chart_version = version;
alter table ranges
  add constraint ranges_chart_version_valid check (chart_version between 1 and version);

-- One row per replaced chart: the hands the range held for versions
-- first_version..last_version inclusive. Retired rows are purged after a while,
-- since no drill page stays open that long.
create table range_chart_revisions (
  range_id uuid not null,
  user_id uuid not null,
  first_version integer not null,
  last_version integer not null,
  hands text[] not null,
  retired_at timestamptz not null default now(),
  constraint range_chart_revisions_pkey primary key (range_id, last_version),
  constraint range_chart_revisions_range_owner_fk foreign key (range_id, user_id)
    references ranges(id, user_id) on delete cascade,
  constraint range_chart_revisions_versions_ordered
    check (first_version between 1 and last_version),
  constraint range_chart_revisions_hands_bounded
    check (cardinality(hands) between 1 and 169)
);
create index range_chart_revisions_retired_idx on range_chart_revisions (retired_at);
