-- R7 Phase 2 (BBE-62) — gcal 이벤트ID 맵을 시트 셀(04!AT · 05!O)에서 Postgres 로 이전.
--
-- 기존 저장 형태: 일정 행의 한 셀에 사용자별 JSON 맵 `{"email":"eventId"}`. "-" = 제외 마커.
-- 이걸 (spreadsheet_id, kind, item_id, email) 4-키 행으로 편다 — JSON 인코딩·read-merge-write·
-- withCellLock(프로세스 내 셀 락, 단일 pm2 인스턴스 전제)이 전부 필요 없어진다.
--
-- 설계 결정 (BBE-62, 2026-08-06 · 근거는 PR 본문·plan 문서 참조):
--  · **event_id='' = tombstone(삭제됨)**. 행을 지우지 않는 이유: 전환기에는 시트 셀도 미러로
--    남아 있어서(불변식③), DB 행을 지우면 다음 읽기가 시트 값을 다시 주워 **이미 지운 이벤트가
--    되살아난다**. 시트 은퇴(R7 Phase 4 #20) 후에는 tombstone 없이 DELETE 로 단순화 가능.
--  · **제외 마커("-")도 그대로 event_id 에 저장**한다 — 마커/실제ID 구분은 소비처(gcal-sync)의
--    기존 규약(EXCLUDE_MARKER)을 그대로 쓰는 게 전환 위험이 가장 낮다.
--  · **users FK 없음** — 0002_gcal_tokens.sql 과 동일 이유(users 테이블은 아직 비어 있다).
--  · spreadsheet_id 를 키에 포함하는 이유: 한 시트를 부부·직원이 공유하고 각자 자기 캘린더에
--    연결한다(email 별 행). 시트가 곧 "일정의 소속"이라 item_id 만으로는 부족하다.

create table if not exists gcal_event_ids (
  spreadsheet_id text not null,
  -- 'meeting'(04 탭) | 'todo'(05 탭)
  kind text not null check (kind in ('meeting', 'todo')),
  -- 일정 행의 A열 id (미팅 id · 투두 id)
  item_id text not null,
  -- 이 매핑을 소유한 세일즈PT 사용자 email
  email text not null,
  -- 구글 캘린더 eventId · '-'(제외 마커) · ''(tombstone = 삭제됨, 위 주석 참조)
  event_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (spreadsheet_id, kind, item_id, email)
);
-- 한 일정 행의 전체 사용자 맵 조회(readGcalMap) · 배치 토글 상태 조회(readGcalStates) 경로.
create index if not exists gcal_event_ids_item_idx
  on gcal_event_ids (spreadsheet_id, kind, item_id);
