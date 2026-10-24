-- 미팅 시작 3시간 뒤 결과 알림 (belie 2026-10-25) — 발송 기록 slot 에 'meeting' 을 더한다.
-- Additive: 기존 행·설정 무변경. 이 파일이 적용되기 전에는 앱이 미팅 결과 알림만 건너뛴다(정기 알림 영향 없음).
alter table public.push_deliveries drop constraint if exists push_deliveries_slot_check;
alter table public.push_deliveries
  add constraint push_deliveries_slot_check check (slot in ('morning','evening','test','meeting'));
