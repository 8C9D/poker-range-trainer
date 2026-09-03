alter table user_training_goals
  drop constraint user_training_goals_supported_goal;

alter table user_training_goals
  add constraint user_training_goals_daily_hand_goal_valid
  check (daily_hand_goal between 1 and 1000000000);
