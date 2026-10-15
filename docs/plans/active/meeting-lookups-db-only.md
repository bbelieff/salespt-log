> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB 정본 기수에서 "그날 미팅 0건·자식 미팅 없음" 같은 정상 결과에도 시트 전체를 다시 훑던 보충 읽기를 없앤다(화석 조사 B2).
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `lib/service/meetings-write.ts` findMeetingsByDateRecord·findChildMeetingRecord (호출 약 8곳: 계약 추가·연결, 미팅 연쇄 삭제·되돌리기, 보관함 등)
> - **읽고 나면 알 수 있는 것**: 왜 지워도 되나(대조 근거) / 무엇은 남겼나 / 되돌리는 법
> - **관련 문서**: ADR-0030, `docs/plans/active/contract-row-lookup-from-db.md`

---
slug: meeting-lookups-db-only
status: active
created: 2026-10-15
branch: fix/meeting-lookups-db-only
---

# 미팅 조회 — "없음"이면 시트를 다시 훑지 않기

- **예전**: R2(미러가 가끔 누락되던 시절) 보충 — DB 에서 그날 미팅이 0건이거나 자식 미팅이 없으면 **시트 04 전체**를 다시 읽었다. 정상 결과("없음")에서도 매번 → 계약 추가·미팅 삭제마다 시트 API 호출.
- **근거**: 2026-10-15 `a2-db-parity`(run 38687219295, 읽기 전용) — meetings 시트 477 / DB 492, sales 1659/1674, db 381/382, contracts·todos·company_archive 일치. **모든 탭에서 DB ≥ 시트, 사람별로도 시트가 더 많은 경우 없음.** (한 사람 시트는 구글 읽기 한도로 못 읽음 → 그래서 아래 하나는 남김.)
- **바꾼 것**: findMeetingsByDateRecord(0건 → 빈 목록), findChildMeetingRecord(없음 → null) — 파일럿은 DB 결과만.
- **남긴 것**: getMeetingRecord(단건 id)의 시트 보충 — 이월 raw 행·레거시 공백 대비, 드물게만 탄다. 비파일럿 기수는 그대로 시트.
- 검증: `tests/service/meeting-lookups-db-only.test.ts` 5개(0건·자식 없음에 시트 호출 0, 단건 보충 유지, 비파일럿 시트), 서비스 테스트 992 통과, check.sh.
- 되돌리기: squash revert 1건. 데이터 변경 없음.