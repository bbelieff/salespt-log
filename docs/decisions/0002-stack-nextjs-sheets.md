---
id: 0002
status: accepted
date: 2026-04-16
---

# 0002 — 스택 결정: Next.js 풀스택 + Google Sheets(SSOT)

## 맥락
수강생용 반응형 웹앱이 필요하다. 요구사항:
- 세련된 UI + 게이미피케이션
- 모바일 입력 중심 / PC 대시보드 중심
- 이미 운영 중인 Google Sheets 기반 경영일지·대시보드 활용
- 1인 개발자 + Claude 에이전트

## 결정
- **Next.js 15 (App Router) 풀스택 TypeScript** — 코드베이스 1개. API Route 에서 `googleapis` 를 직접 호출.
- **Google Sheets 가 유일한 데이터 저장소**. 별도 DB 도입 금지. 대시보드는 시트 수식이 이미 계산하므로 앱은 **읽어서 Recharts 로 다시 그린다**.
- **수강생마다 개별 시트**. `email → spreadsheetId` 는 마스터 레지스트리 시트에 저장.
- **NextAuth v5 + Google Provider** 로 인증. 선택한 기수/이름은 레지스트리에서 검증.
- **자체 VPS 배포**: `next build --standalone` + Docker + Caddy (자동 HTTPS). Vercel 쓰지 않음.

## 대안 비교
| 대안 | 기각 이유 |
|---|---|
| FastAPI + Next.js 분리 | 1인 + Claude 환경에서 코드베이스 2개는 순손해. CORS·배포 복잡. |
| Python fullstack (Streamlit/Reflex) | 게이미피케이션 UX 완성도 한계. 반응형 분기 약함. |
| Supabase/Postgres 추가 | 수강생이 이미 시트를 보고 있음. 이중화는 동기화 버그 유발. |
| Vercel 배포 | 사용자 보유 VPS 존재 → 비용·이식성에서 자체 호스팅이 유리. |

## 결과
- Python 하네스(1일차) 폐기. 문서·원칙만 재활용.
- `lib/` 레이어 4개 + `app/` 1개 + `components/` 로 고정.
- 구조 테스트가 `googleapis` 를 `lib/repo/` 밖에서 부르지 못하게 강제.

## 번복 조건
- Sheets API 쿼터(읽기 300/분/프로젝트, 쓰기 60/사용자/분)가 실제 병목이 되면 → 읽기 캐시 레이어(KV, 메모리) 또는 BigQuery 미러링을 **새 ADR** 로 도입.
