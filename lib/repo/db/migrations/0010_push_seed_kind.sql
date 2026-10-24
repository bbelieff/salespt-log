-- 「오늘의 씨앗」 알림 종류 추가 (docs/plans/active/web-push-notifications.md §14, belie 2026-10-24).
-- Additive: existing push settings gain 'seed' (default on, as approved); the column default includes it too.
-- No student records change.
update public.push_preferences set kinds = array_append(kinds, 'seed'), updated_at = now()
  where not ('seed' = any(kinds));
alter table public.push_preferences
  alter column kinds set default '{overdue,today,meeting,initial,recontact,stalled,seed}';
