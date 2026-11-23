## 2026-11-23 · 사업계획서 작성도구 1단계 — ① 자료 꾸러미
- 브랜치 `feat/bizplan-kit`. belie 「사업계획서작성도구 계속 진행해보자」(11-22 기획 승인 이어서). 결정 = [ADR-0039](../decisions/0039-bizplan-tool.md), [plan](../plans/active/bizplan-tool.md).
- 변경: 업무도구 사이드 행 + `/work-tools/business-plan`(자료 올리기 · 팩트시트 · 꾸러미 ZIP · 시작 프롬프트 · 사용법), `/api/bizplan/kit`(공식 빌더·양식, 경영일지 이용자만).
- 자율결정: 저장소가 공개라 빌더를 코드/DB 대신 관리자 드라이브 비공개 폴더에 둠(DB 마이그레이션 없음). 고객 파일은 브라우저에서만 묶음. ZIP 은 라이브러리 없이 저장 방식.
- 미완료: 폴더를 leadbzcenter 에 보기 공유(자동 승인 검사 차단 → belie 직접). 다음 PR = 숫자 자동 읽기(OCR).
