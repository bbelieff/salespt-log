# 인시던트 — DB관리 4채널 read 전체 실패 (2026-06-22)

> **📄 요약**: `loadDBOverview` 가 `Promise.all` 이라 한 섹션 read 만 throw 해도 4채널 전부 실패. allSettled 로 섹션 격리.

## 증상
DB관리 탭에서 "구매목록" 등 4채널이 통째로 안 불러와짐(전체 에러).

## 원인
- `lib/service/db.ts loadDBOverview` 가 `Promise.all([5개 read])` → **하나라도 reject 면 전체 reject**(all-or-nothing).
- 신규 `readBannerPosts`(AF:AI) 등 한 섹션이 throw 하면 멀쩡한 매입DB/직접생산/현수막/콜까지 동반 실패.
- 개별 read 는 이미 전환(tolerant) read 라 옛/새 레이아웃은 처리하지만, 상위 조립이 all-or-nothing 으로 남아 있었음.

## 조치 (fix/db-overview-resilient)
- `loadDBOverview` → `Promise.allSettled` + `rowsOrEmpty` 헬퍼: 섹션별 실패 시 그 채널만 빈 목록(+경고 로그), 나머지 정상. `resolveSheet`(사용자 없음)만 throw 유지.

## 후속 (비차단)
- 37개 아레나 시트+템플릿에 새 레이아웃 이관(I:O 직접생산·F/U 부가세여부·AF:AI 게시로그 헤더, §2.5 가드, 멱등). 이관 전까진 tolerant read + allSettled 로 버팀.
- (선택) overview 응답에 섹션 실패 플래그 → UI "일부 불러오기 실패" 배지(관측가능성).
