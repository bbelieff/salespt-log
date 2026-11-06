-- DB 시트 자동 확인의 「새 DB N건」 알림(belie 2026-11-06) — 발송 기록 slot 에 'dbfeed' 를 더한다. 0012 다음.
alter table public.push_deliveries drop constraint if exists push_deliveries_slot_check;
alter table public.push_deliveries
  add constraint push_deliveries_slot_check check (slot in ('morning','evening','test','meeting','reminder','dbfeed'));
