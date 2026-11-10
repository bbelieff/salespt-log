---
slug: company-info-email-v2
status: active
created: 2026-11-10
worktree: .claude/worktrees/agent-a710a1545422d2b0f (branch feat/company-info-email-v2)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보 확장보기 [대표자] 연락처 아래에 「이메일」 칸 하나를 DB 전용(시트 열 없음)으로 더한다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 업체정보 편집기(CompanyInfoField·company-info-defs), 미팅 메모 자동입력(parse-memo), TXT 내보내기, CompanyInfo 스키마·DB read
> - **읽고 나면 알 수 있는 것**: 이메일이 어디에 저장되고 어디에 안 실리는지, 옛 PR #1136 과 무엇이 다른지
> - **관련 문서**: `docs/domains/data-model.md`(CompanyInfo), `docs/domains/sheet-structure.md`, `docs/design/components.md`(CompanyInfoField)

# 업체정보 이메일 칸 (v2 — DB 전용)

## Intent (왜)
belie 2026-11-10 「지금 버전과 상황에 맞게 다시 만들어봐」 — 오래된 PR #1136(04 CE·06 BM 시트 미러 + 141개 시트
census)을 지금 구조에 맞게 다시 만든다. 2026-08-24 부터 DB 가 유일한 정본이고 시트는 비동기 미러·백업이다.
게다가 옛 PR 이 쓰려던 04 CE·06 BM 은 이미 맞춤공고(확장5)가 쓰고 있다. 그래서 **시트 열을 늘리지 않고
DB payload 에만** 저장한다 — census·DB 감사 워크플로·registry-parity 스크립트는 가져오지 않는다.

## 코드로 확인한 저장 경로 (2026-11-10)
- 04 미팅: DB payload = Meeting 객체 그대로(`mirror.ts`·`meetings-write.ts` patch = DB base 병합) →
  `meetingFromDbPayload` 의 `Meeting.safeParse` 가 이메일을 보존. 시트 코덱 `meetingToRow` 는 열 목록만 써서 무시.
- 06 업체정보: upsert payload = `{업체명, 계약일, ...CompanyInfo}` 평탄화 → `companyInfoFromDbPayload` 는 열 목록만
  복원했으므로 **`COMPANY_FIELDS_DB_ONLY` 복원 추가**(이 PR). 시트 코덱 `companyInfoToArchiveRow` 는 무시.
- DB관리시트 contact.ci·간편인증·통화요약: CompanyInfo JSON 그대로 — 영향 없음.
- 알려진 한계(시트 열이 없어서 생김, 이 PR 범위 밖):
  - 06 계약 키 개명(`renameCompanyInfoKey`) — 새 키 DB 행은 키필드만, 화면은 시트 스냅샷으로 fallback →
    결제카드 06 화면에서 이메일이 안 보인다(04 미팅 원본에는 남음, 04 업체정보를 다시 저장하면 06 에도 다시 실림).
    파일 주석이 개명 컨텐츠 캐리오버 재설계를 「섣부른 재설계 금지」로 막고 있어 손대지 않았다.
  - 기수 이월(`carriedMeetingPayload`) — 시트 행(열문자) 기반이라 이메일이 따라가지 않는다.

## Acceptance Criteria (수용 기준)
- [x] `CompanyInfo.이메일` default "" · 차단 검증 없음
- [x] 확장보기 [대표자] 연락처 바로 아래 전폭 한 칸, 기본보기에는 없음(적혀 있으면 「확장보기에 적힌 항목」에 셈)
- [x] 기본↔확장 전환은 저장을 만들지 않음
- [x] blur 정리(공백·전각 ＠·mailto:) · 모양이 아니면 amber 안내만
- [x] 미팅 메모 「이메일/메일/E-mail」 라벨 → 이메일 칸 제안(모양 아니면 기본 체크 안 함), 계정 라벨은 보관함
- [x] TXT 내보내기 연락처 다음 줄(비면 생략)
- [x] 04·06 시트 행 폭 불변 · DB payload 왕복
- [ ] `scripts/check.sh` 통과 · CI 초록

## Log
- 2026-11-10 작업 시작·구현·시험 추가(tests/components/company-info-email.test.ts · tests/repo/company-info-email-io.test.ts).
