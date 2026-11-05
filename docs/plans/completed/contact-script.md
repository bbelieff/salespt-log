---
slug: contact-script
status: completed
created: 2026-11-05
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch feat/contact-script-popup)
---

# 업체정보 팝업 「대본」 — 컨택 대본·문자 양식(계정별 저장)

## Intent (왜)
- belie 2026-11-05: 업체정보 「팝업」의 기본보기·확장보기 옆에 「대본」 버튼. 누르면 컨택 스크립트, 기본 제공·수정 가능.
- 문자 양식(필요서류·미팅일정 안내)은 복사 버튼.
- 대본·문자는 Supabase 에 저장 — 수강생 각자 고친 대로 다음에 열린다.

## Acceptance Criteria (수용 기준)
- [x] 팝업 보기 칸 [기본보기 | 확장보기 | 대본] — 접힌 카드(팝업 밖)에는 「대본」 없음
- [x] 대본·문자 기본값(belie 원문, 「부과세」→「부가세」 오타만 고침)
- [x] 「수정」 → 저장하면 내 계정(세션 이메일)에만 저장, 다음에 열면 고친 글 · 「기본 대본으로 되돌리기」
- [x] 문자 양식 「복사」
- [x] 마이그레이션 `0015_contact_scripts.sql`(새 테이블만, RLS on·anon/authenticated 권한 없음)
- [x] 시험: pglite 저장·되돌리기·계정 분리 / API 401·본인만·400·503 / 화면 보기 칸·저장·복사
- [x] 운영 DB 적용 — DB Migrate 는 운영 서버에 설치된 코드(installed, master)로 돈다: 병합·배포 → dry-run(대기 = 0015 하나) → 적용. belie 승인(「DB적용진행」) 후 run 41878939084 적용, contact_scripts 생성·RLS 확인
- [x] `bash scripts/check.sh` · production build · 합성 화면 확인(PC 팝업 대본·수정·저장 후 새로고침 유지, 375px 가로 넘침 없음)

## Log
- 2026-11-05 구현. CompanyInfoEditor 500줄 상한 — closeModal 한 줄로 줄여 499줄.
