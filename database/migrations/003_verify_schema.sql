-- ============================================================================
-- CALORIA — schema compatibility check
--
-- Run this AFTER 001_init.sql and 002_seed_foods.sql.
--
-- Why: `create table if not exists` is safe, but it does NOT change an existing
-- table. If you reuse a Supabase project that already contains e.g. a `users`
-- table from another application, the migration would silently keep the old
-- structure and CALORIA would fail at runtime. This script fails loudly instead.
--
-- If it reports a mismatch: use a dedicated Supabase project, or rename/drop the
-- conflicting tables after backing up the other application's data.
-- ============================================================================

do $$
declare
  missing_list text;
begin
  select string_agg(m.table_name || '.' || m.column_name, ', ' order by m.table_name, m.column_name)
    into missing_list
  from (
    select e.table_name, e.column_name
    from (values
      ('users', 'id'),
      ('users', 'telegram_id'),
      ('users', 'username'),
      ('users', 'first_name'),
      ('users', 'last_name'),
      ('users', 'photo_url'),
      ('users', 'age'),
      ('users', 'height'),
      ('users', 'weight'),
      ('users', 'target_weight'),
      ('users', 'sex'),
      ('users', 'activity_level'),
      ('users', 'goal'),
      ('users', 'timezone'),
      ('users', 'onboarding_completed'),
      ('users', 'created_at'),
      ('users', 'updated_at'),

      ('food_products', 'id'),
      ('food_products', 'name'),
      ('food_products', 'name_normalized'),
      ('food_products', 'search_text'),
      ('food_products', 'calories'),
      ('food_products', 'protein'),
      ('food_products', 'fat'),
      ('food_products', 'carbohydrates'),
      ('food_products', 'source'),
      ('food_products', 'source_id'),
      ('food_products', 'category'),
      ('food_products', 'emoji'),
      ('food_products', 'aliases'),
      ('food_products', 'default_serving_grams'),
      ('food_products', 'piece_grams'),
      ('food_products', 'usage_count'),
      ('food_products', 'created_by'),
      ('food_products', 'is_public'),
      ('food_products', 'created_at'),
      ('food_products', 'updated_at'),

      ('food_entries', 'id'),
      ('food_entries', 'user_id'),
      ('food_entries', 'product_id'),
      ('food_entries', 'product_name_snapshot'),
      ('food_entries', 'meal_type'),
      ('food_entries', 'amount_grams'),
      ('food_entries', 'calories'),
      ('food_entries', 'protein'),
      ('food_entries', 'fat'),
      ('food_entries', 'carbohydrates'),
      ('food_entries', 'consumed_at'),
      ('food_entries', 'entry_date'),
      ('food_entries', 'created_at'),
      ('food_entries', 'updated_at'),

      ('weight_history', 'id'),
      ('weight_history', 'user_id'),
      ('weight_history', 'weight'),
      ('weight_history', 'recorded_on'),
      ('weight_history', 'recorded_at'),
      ('weight_history', 'created_at'),
      ('weight_history', 'updated_at'),

      ('body_measurements', 'id'),
      ('body_measurements', 'user_id'),
      ('body_measurements', 'recorded_on'),
      ('body_measurements', 'waist'),
      ('body_measurements', 'hips'),
      ('body_measurements', 'chest'),
      ('body_measurements', 'note'),
      ('body_measurements', 'created_at'),
      ('body_measurements', 'updated_at'),

      ('progress_photos', 'id'),
      ('progress_photos', 'user_id'),
      ('progress_photos', 'recorded_on'),
      ('progress_photos', 'data_url'),
      ('progress_photos', 'note'),
      ('progress_photos', 'created_at'),

      ('user_goals', 'id'),
      ('user_goals', 'user_id'),
      ('user_goals', 'calories'),
      ('user_goals', 'protein'),
      ('user_goals', 'fat'),
      ('user_goals', 'carbohydrates'),
      ('user_goals', 'water_ml'),
      ('user_goals', 'updated_at'),

      ('reminder_settings', 'id'),
      ('reminder_settings', 'user_id'),
      ('reminder_settings', 'reminders_enabled'),
      ('reminder_settings', 'morning_enabled'),
      ('reminder_settings', 'breakfast_enabled'),
      ('reminder_settings', 'lunch_enabled'),
      ('reminder_settings', 'dinner_enabled'),
      ('reminder_settings', 'evening_enabled'),
      ('reminder_settings', 'water_enabled'),
      ('reminder_settings', 'morning_time'),
      ('reminder_settings', 'breakfast_time'),
      ('reminder_settings', 'lunch_time'),
      ('reminder_settings', 'dinner_time'),
      ('reminder_settings', 'evening_time'),
      ('reminder_settings', 'quiet_start'),
      ('reminder_settings', 'quiet_end'),
      ('reminder_settings', 'water_interval_hours'),
      ('reminder_settings', 'timezone'),
      ('reminder_settings', 'created_at'),
      ('reminder_settings', 'updated_at'),

      ('notification_logs', 'id'),
      ('notification_logs', 'user_id'),
      ('notification_logs', 'notification_type'),
      ('notification_logs', 'dedupe_key'),
      ('notification_logs', 'scheduled_at'),
      ('notification_logs', 'sent_at'),
      ('notification_logs', 'status'),
      ('notification_logs', 'created_at'),

      ('water_logs', 'id'),
      ('water_logs', 'user_id'),
      ('water_logs', 'log_date'),
      ('water_logs', 'amount_ml'),
      ('water_logs', 'goal_ml'),
      ('water_logs', 'created_at'),
      ('water_logs', 'updated_at'),

      ('favorites', 'id'),
      ('favorites', 'user_id'),
      ('favorites', 'product_id'),
      ('favorites', 'created_at'),

      ('bot_pending_entries', 'id'),
      ('bot_pending_entries', 'user_id'),
      ('bot_pending_entries', 'payload'),
      ('bot_pending_entries', 'expires_at'),
      ('bot_pending_entries', 'created_at')
    ) as e(table_name, column_name)
    left join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = e.table_name
     and c.column_name = e.column_name
    where c.column_name is null
  ) m;

  if missing_list is not null then
    raise exception
      'CALORIA schema mismatch. Missing columns: %. '
      'This database may belong to another application. Use a dedicated Supabase project, '
      'or rename/drop the conflicting tables after backing up their data.', missing_list;
  end if;

  raise notice 'CALORIA schema check passed: all required tables and columns exist.';
end $$;