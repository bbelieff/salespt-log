# 세일즈PT 경영일지

세일즈PT 수강생을 위한 모바일 영업일지 웹앱.
Google Sheets를 SSOT로 사용하는 Next.js 풀스택 앱.

## 구조

| 디렉토리 | 용도 |
|---|---|
| `prototype/` | 모바일 UI 프로토타입 (HTML 단일 파일, Tailwind CDN) |
| `app/` | Next.js 15 App Router |
| `lib/` | 비즈니스 로직 (repo → service → app 레이어) |
| `docs/domains/` | 데이터 모델 / 도메인 설계 |
| `docs/plans/active/` | PDCA 플랜 문서 |

## 백엔드 모델

`docs/domains/data-model.md` 참조 — Google Sheets `01 영업관리` 탭과 1:1 매핑.

## 푸터 4탭

| 탭 | 시트 컬럼 | 역할 |
|---|---|---|
| 컨택관리 | E~I | 채널별 생산/유입/컨택/성공 + 미팅예약 |
| 일정·계약 | J~P | 미팅 일정 + 계약/수임비 |
| 수납관리 | Q~T | 승인/수납/금액 |
| DB관리 | (별도) | DB 주문/구매 입력 → 총비용 계산 |

## 프로토타입 미리보기

```bash
npx serve dev-harness/prototype -l 5555
# → http://localhost:5555
```

## Claude Code Action

이슈/PR에 `@claude 작업 지시` 멘션하면 자동 작업 후 PR 생성.
필수 시크릿:
- `ANTHROPIC_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (시트 접근용, 선택)
