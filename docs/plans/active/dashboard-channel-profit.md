> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 영업이익 칸을 누르면 보이는 「채널별 남은 돈」 표(belie #7 계약별 이익 → 채널 단위) 목업·구현 계획과 수용 기준.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `components/dashboard/ChannelProfitBreakdown.tsx`·`channel-profit.ts`·`DashboardFinance.tsx`·`FinanceSummaryBoxes.tsx`(prop 1개)·`ChannelPerformance.tsx`(CH_COLOR export), `lib/util/finance-period.ts`·`contract-link.ts`, `lib/service/contract-channel.ts`·`termination-count.ts`·`dashboard.ts`, `lib/types/dashboard.ts`, `app/(app)/dashboard/page.tsx`(prop 3개)
> - **읽고 나면 알 수 있는 것**: 표가 어떤 숫자로 맞춰지는지 · 계약이 어느 줄로 가는지 · 목업을 어떻게 여는지 · 무엇을 일부러 안 했는지
> - **관련 문서**: [components.md §9-2](../../design/components.md) · [data-model.md 대시보드 view](../../domains/data-model.md) · [ADR-0034](../../decisions/0034-revenue-all-contracts-by-period.md) · [dashboard-card-headlines.md](./dashboard-card-headlines.md)(#8, 같은 재무 묶음) · [dashboard-follow-ups.md](./dashboard-follow-ups.md)

# 영업이익 상세 「채널별 남은 돈」 (2026-10-12, belie #7)

## 범위
- 포함: 영업이익 상세 패널(기존 「기간 · 계약 N건 | 이익률」 줄 아래)에 문장 한 줄 + 채널 표(매입DB·직접생산·현수막·콜·지·기·소 × 매출·비용·남은 돈)
  + 보조 줄(영업기록 없음 › / 채널 모름 / 확인 중) + 추가 비용 › + 합계 「영업이익」. 위 기간 칩(전체·이번 달·이번 주·직접 설정)을 따른다.
- belie 기본안: 표는 패널 안(채널별 성과 카드·카드 순서·높이 무변), 문장도 패널 안에만. 현금 기준(발생주의 #6 보류).
- 제외: 계약 한 건마다의 이익 목록(DB 비용 행에 계약·미팅 연결 키가 없어 정직하게 나눌 수 없다), 채널 줄 눌러 거르기(화면 없음).
- 서버: `GET /api/dashboard` 에 optional `contractChannels: { key, channel }[]` 하나. 이미 읽은 계약·미팅 배열로 만든다(새 DB·시트 읽기 0,
  KPI·channelMatrix·costBreakdown 무변 — ADR-0034 §6). 쓰기 경로·스키마·마이그레이션 없음. 금액 계산은 모두 화면에서 기존 기간 함수로.

## 스펙 리뷰 반영
1. (major) 키 = `contractChannelKey`(@/util/contract-link, 서버·화면 공용): AK 가 있으면 `행|ak:AK`(이름·계약일을 고쳐도 유지), 없으면 `행|계약일|업체명`.
   응답에 없는 계약 = 「확인 중」(링크 없음, 「영업기록 없음」으로 몰지 않음) + 어긋난 묶음마다 대시보드 다시 불러오기 **1번만**
   (GET /api/dashboard 가 원장 반복 지출을 만드는 쓰기를 포함 — 반복 금지). 그래도 없으면 「확인 못 함」.
2. (major) 「영업기록 없음 ›」은 `manual:` 계약만(/payment 의 「영업기록 없음 ＋」로 연결 가능). AK 빈 값·못 찾은 미팅은 「채널 모름」(링크 없이 설명).
3. 빈 기간 = 매출·DB 비용·추가 비용이 **모두 0**일 때만. 추가 비용을 못 읽었으면(null) 표와 「확인 못 했어요」를 보인다.
4. 채널 줄은 CHANNEL_ORDER 고정(칩 바꿔도 안 움직임), 문장이 고른 줄만 `bg-blue-50`. 문장 「{채널}에 쓴 돈의 N.N배를 벌었어요」(받침 표 불필요).
5. 금액: 만원으로 먼저 반올림 후 0 이 아닐 때만 「−」, 1억 이상 「1.9억」, 전체 금액은 title + sr-only, 숫자 칸 `pl-1.5`.
6. termination-count 는 공용 조회(contractMeetingResolver) 전에 manual 을 건너뛴다(unknown 이벤트 방지) — 테스트 추가.
7. `channel: Channel | null`, 응답에서 업체명·계약일 제거. lib/types/dashboard.ts:47 「만원」 주석 → 원. tokens.md 영업이익 보라는 #8 이 이미 정정(남은 돈 행만 추가).
8. 목업 스위치 `?staleChannels=1` `?renamed=1` `?stuck=1` `?channels=large` `?channels=empty&ledgerFail=1`.
9. jsdom 테스트 `vi.mock("next/link")`. preview.html 예시 추가.

## 병합 순서·겹침 (§3.5)
- `lib/types/dashboard.ts`(공용 계약)는 다른 트랙과 겹치면 **타입만 먼저 단독 PR**. 같은 브랜치(#3·#4·#8)와는 `DashboardFinance.tsx`·`page.tsx`·docs 를 함께 고쳤다(작은 고정점 편집).
- 업체 고유번호(#1)가 생기면 `contractChannelKey` 한 곳만 바꾼다. 유입 경로(#10)가 생기면 채널 출처는 그 값을 먼저, 미팅 채널은 대체값(코드 미반영 — 메모).
- 선택(이번 범위 밖): 계약 추가·수정·해지·삭제 뮤테이션이 `['dashboard']` 도 무효화하면 「확인 중」이 덜 생긴다(`lib/query/contract-payment-hooks.ts` 는 다른 트랙이 고치는 중이라 손대지 않음).

## 목업
- `npm run build`(폰트) 후 `node tests/browser/dashboard-followups-server.mjs` → 출력 주소. 영업이익 칸을 누른다.
- `/dashboard?channels=demo`(기본 묶음) · `?channels=large`(1억 넘는 칸·−9,500만, 320px 폭) · `?channels=loss`(모든 채널 적자) · `?channels=empty`(빈 기간)
- 플래그(같이 써도 됨): `&ledgerFail=1`(원장 503) · `&noChannels=1`(옛 응답 — 표 없음) · `&staleChannels=1`(새 계약 → 확인 중 → 1번 다시 불러와 매입DB로) ·
  `&renamed=1`(AK 있는 계약은 채널 유지, AK 없는 계약은 확인 중 → 채널 모름) · `&stuck=1`(다시 불러와도 옛 응답 → 「확인 못 함」)
- `?channels` 가 없으면 A·B 목업 응답 그대로(응답에 contractChannels 없음 → 표 없음).
- 데이터: `tests/browser/dashboard-channel-profit-data.mjs`(오늘 KST 기준 오프셋, 업체명 「가상상사A~J」), 쿠키: `dashboard-channel-profit-scenario.ts`.

## 수용 기준(목업 실측 2026-10-12)
- [x] 기간 4종에서 표 합계(원) = 매출·비용·영업이익 칸 — 전체 18,600,000/9,300,000/9,300,000, 이번 달·이번 주·직접 설정(09/12~10/02)도 일치
- [x] 칩 전환 중 /api/* 요청 0건 · 어긋남 시 /api/dashboard 1건만 추가, 정상 시 0건
- [x] manual → 영업기록 없음 › (/payment 도착, 그 계약에만 「영업기록 없음 ＋」), AK 빈 값 → 채널 모름(링크 없음), 이월·해지 포함(해지 반환은 해지일 기간·그 채널)
- [x] 320·360px(`large`)에서 `scrollWidth == innerWidth`, 숫자 줄바꿈 없음 · 1024·1600 표 `pc:max-w-lg`
- [x] 원장 실패 → 「확인 못 했어요」, 합계 비용 = DB 비용 · 빈 기간 + 원장 실패 → 표 보임 · 옛 응답 → 표·문장 없음
- [x] 패널을 열기 전 화면 무변(채널별 성과 「8주 누적」 그대로) · 패널 글에 「이월」「시즌」 없음 · `fin-profit-table` 없음
- [ ] check.sh 전체(오케스트레이터 몫 — 이 작업은 대상 테스트·구조 테스트·tsc·eslint 만 실행)

## 커밋 메모(feat)
```
feat(dashboard): 영업이익 상세에 채널별 남은 돈 표

Changelog: 영업이익을 누르면 채널마다 번 돈·쓴 돈·남은 돈을 볼 수 있어요.
전: 영업이익이 얼마인지는 보였지만 어느 채널에서 남았는지는 따로 계산해야 했어요.
후: 영업이익 칸을 누르면 고른 기간의 채널별 매출·비용·남은 돈과 가장 잘 남긴 채널이 한눈에 보여요.
```
