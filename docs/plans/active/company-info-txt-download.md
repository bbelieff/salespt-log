---
slug: company-info-txt-download
status: active
created: 2026-06-22
owner: belie
related: 0016-company-info-txt-export
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보생성(TXT)을 드라이브 업로드 대신 브라우저 직접 다운로드로 전환.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: app/api/company-info/export/route.ts, components/CompanyInfoEditor.tsx
> - **읽고 나면 알 수 있는 것**: 드라이브 의존 제거, 다운로드 흐름
> - **관련 문서**: [ADR-0016](../../decisions/0016-company-info-txt-export.md)

# fix — 업체정보 TXT 브라우저 직접 다운로드

## 변경 (belie 작성분 커밋·배포)
- `app/api/company-info/export/route.ts`: TXT 본문을 응답으로 반환(브라우저 다운로드). 드라이브 업로드 경로 의존 제거.
- `components/CompanyInfoEditor.tsx`: "업체정보생성(TXT)" → 응답을 받아 브라우저에서 파일 저장(Blob/anchor download).

## 효과
- 드라이브 연결 미완(테스터 폴더 등)과 무관하게 TXT 즉시 내려받기 가능 → [1] 드라이브 의존 우회.

## 수용 기준
- 업체정보 채운 계약/미팅에서 TXT 생성 → 파일 정상 다운로드. typecheck/lint/test 그린 + build + 배포 + health 200.

## Log
- 2026-06-22 커밋·배포(fix/company-info-txt-download): 드라이브→브라우저 다운로드 전환.
