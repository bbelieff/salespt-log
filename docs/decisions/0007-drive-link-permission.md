# ADR-0007 — Drive 연결·권한 모델

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Drive는 "기존 폴더 연결" 모델 — `01 피드백업체` 자동 탐색 + SA viewer + [다시 연결]
> - **누가 읽나요**: 개발자 + 운영자
> - **어떤 기능·작업과 연결?**: `lib/repo/drive-client.ts`(폴더 탐색 함수 신규), 온보딩 `app/api/setup`, 요약카드 [Drive 바로가기]
> - **읽고 나면 알 수 있는 것**: 왜 생성 안 하고 연결만 하나, SA viewer 선결조건, 탐색 실패 처리
> - **관련 문서**: `practice-and-drive.md` §6

- **Status**: accepted
- **Date**: 2026-06
- **Supersedes**: 없음

## Context
수강생 업체 폴더(`Drive > [수강생] > 01 피드백업체 > [업체]/`)를 앱과 연동해야 한다. 현재는 admin이 폴더를 수동 생성·공유 중. 제약: 권한 안전, Drive API quota, 사고(취소 계약 빈 폴더 등) 방지.

## Decision
1. **"기존 폴더 연결" 모델** (앱이 폴더를 생성하지 않음).
2. **온보딩**(경영일지 URL 입력 단계)에 Drive 부모 폴더 경로를 함께 등록 → `01 피드백업체` 폴더를 **자동 탐색**(prefix 매칭) → `feedback_folder_id` 저장.
3. **[Drive 바로가기]** 버튼 → `01 피드백업체` 폴더를 새 탭으로 열기.
4. **권한**: 서비스 계정(SA)이 부모 폴더에 최소 **viewer**. 온보딩 시 admin이 SA 이메일을 부모 폴더에 공유. 폴더 생성·권한 자동 부여는 범위 밖.
5. 탐색 실패 시 상태 배지 + **[다시 연결]**(경로 재입력).

## Alternatives considered
- **자동 폴더 생성(계약 확정 트리거)**: quota·취소 계약의 빈 폴더·권한 흐름 복잡 → 현 스코프 기각(추후 Phase 후보).
- **수동 생성 버튼(앱이 폴더 만들기)**: 생성 API 위험 + 이미 수동 운영 중이라 불필요 → 기각.

## Consequences
- (+) Drive API 부하·사고 최소화, 기존 운영 흐름 활용, 온보딩 시 폴더/시트 ID 자동 등록으로 수작업 감소.
- (의존성) 이름 규약 `01 피드백업체`에 의존 → 표기 갈리면 탐색 실패(prefix 매칭으로 완화). 폴더 이동/이름변경 시 재연결 필요. SA viewer 공유가 선행 조건.

## Note — 구현 시 검증된 사실 (형 세션 코드 대조, 2026-06)
- `lib/repo/drive-client.ts`의 `findSheetByExactName`·`findSheetByNamePrefix`는 **둘 다 `mimeType='application/vnd.google-apps.spreadsheet'` 전용** → 폴더 탐색에 그대로 못 씀. **폴더용 신규 함수**(`mimeType='application/vnd.google-apps.folder'`, 부모 폴더 하위 prefix 매칭) 추가 필요. SA 이메일: `masterbot@saleslog-494703.iam.gserviceaccount.com`.
