-- 미리 알림 1단계 (docs/plans/active/web-push-notifications.md §15, belie 2026-10-26: 미팅 1시간 전 기본, 하루 6건).
-- Additive: three settings columns with defaults (everyone starts with reminders on) and a 'reminder' delivery slot
-- next to 0011's 'meeting'. No student records change.
alter table public.push_preferences
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists meeting_lead_minutes int not null default 60 check (meeting_lead_minutes in (30, 60, 120)),
  add column if not exists reminder_kinds text[] not null default '{meeting_before,todo_before,absence_retry}';
alter table public.push_deliveries drop constraint if exists push_deliveries_slot_check;
alter table public.push_deliveries
  add constraint push_deliveries_slot_check check (slot in ('morning','evening','test','meeting','reminder'));
