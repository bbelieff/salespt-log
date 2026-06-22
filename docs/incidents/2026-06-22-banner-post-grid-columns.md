# 인시던트 — 현수막 게시 저장 실패 (AF:AI 컬럼 부재, 2026-06-22)

> **📄 요약**: C2 게시 로그가 `03 DB관리`!AF:AI 에 쓰는데, 라이브/템플릿 시트는 ~AD(콜·지·기·소)까지만 열이 있어 grid 초과로 write throw. 첫 게시 시 컬럼 자가치유로 복구.

## 증상
현수막 주문 카드에서 게시일·게시수 입력 후 저장이 반영 안 됨(에러 조용). #434(allSettled) 덕에 read 는 빈 배열로 강등돼 탭은 살아 있었으나 게시 자체가 저장 불가.

## 원인
- C2(#429)가 AF:AI 게시 로그를 도입했으나, 기존 시트들은 4섹션(~AD)까지만 컬럼이 존재.
- Sheets 는 grid 밖 좌표 쓰기를 "exceeds grid limits" 로 거부 → `appendBannerPost` writePost throw.
- 코드·API·UI·Zod 체인은 정상이었음(데이터 위치 문제).

## 조치 (fix/banner-post-columns)
- `banner-post.ts`: `ensureBannerCols` — `ensureGridColumns(…,35)`(AI열)로 컬럼 자동 확장 + AF3:AI3 헤더(빈 셀에만, §2.5). append/update 진입 시 1회(첫 게시 자가치유, 멱등).
- `BannerPostingLog`: 저장 실패 시 에러 메시지 노출(이전엔 조용). 남은=0 이면 입력행 숨김.
- (별도) 37시트+템플릿 일괄 이관은 자가치유로 점진 대체 — 필요 시 스크립트.

## 비고
- "게시기록 블록을 기타 필드 위로" UI 요청은 RowForm 구조상 별도 작업으로 보류(기능엔 무관).
