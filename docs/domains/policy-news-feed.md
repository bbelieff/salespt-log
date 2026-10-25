---
status: verified
---
> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 정책자금뉴스 공고를 경영일지가 칸 단위로 읽는 약속(공고 JSON 계약 schema 1).
> - **누가 읽나요**: 개발자(경영일지·카페봇 양쪽)
> - **어떤 기능·작업과 연결?**: 맞춤공고 2단계 — VPS `export_news_json.py` → `lib/repo/policy-news.ts` → `lib/analytics/policy-announcement.ts`
> - **읽고 나면 알 수 있는 것**: 파일이 어디 있나 · 칸이 무엇인가 · 무엇을 바꾸면 깨지나
> - **관련 문서**: plans/active/policy-news-feed.md, plans/active/company-grant-fields.md

# 정책자금뉴스 공고 피드 (2026-10-26)

## 흐름
```
PC 07:00 pn.py build → scp → VPS /opt/bots/salespt-cafe-bot/staged/정책자금뉴스_<날짜>.xlsx   (기존)
VPS export_news_json.py (읽기 전용) → /var/www/policy-news/data/<날짜>.json · index.json   (신규)
   = https://salesptlog.online/news/data/<날짜>.json (Caddy handle_path /news/* 기존 블록이 내림)
경영일지 lib/repo/policy-news.ts → 최근 14게시일 fetch(30분 캐시) → mergeAnnouncements
```
- 카페 게시(`post_policy_news.py`)·페이지 동기화(`sync_news_pages.py`)는 건드리지 않는다. 내보내기가 실패해도 게시는 그대로.
- 내용은 이미 공개 중인 `/news/<날짜>` HTML 과 같은 공고 정보다(개인정보 없음). 공개 폴더라 같은 유출 단어 검사를 거친다.
- 45일 지난 날짜 파일은 지운다.

## 계약 — schema 1
`index.json`: `{"schema":1,"updatedAt":ISO,"dates":["YYYY-MM-DD",…]}`(최신 먼저)
`<날짜>.json`: `{"schema":1,"date":"YYYY-MM-DD","source":"staged","rows":[줄…]}`

줄 = `xlsx_to_rows.extract_rows` 출력 그대로(한국어 칸 이름). 경영일지가 읽는 칸:

| 칸 | 쓰임 |
|---|---|
| 사업명 · 주관기관 | 제목, id(링크 없을 때) |
| 공고원문링크 | id = 기업마당 `pblancId`, 원문 링크 |
| 지역 | 범위(전국 / 시·도 / 시·군·구) — `parseScopes` |
| 지원대상 · 업종제한 · 창업업력제한 · 특정타겟 | 3단계 매칭 판정(소상공인·제외 업종·업력·청년 등) |
| 마감일 | 날짜 / 예산 소진 / 상시 / 모름 — `parseDeadline` |
| 성격 · 최대지원금액 · 공고일 · 확인상태 · 대상업종태그 · 대출종류 | 표시 |

- 추정 문구는 내보내기 전에 이미 `확인안됨` 으로 바뀌어 있다 → 경영일지는 `확인안됨` = 모름(빈 값)으로 읽는다.
- **바꿀 때 규칙**: 칸 추가는 schema 유지(경영일지는 모르는 칸을 무시). 칸 이름 변경·삭제·뜻 변경은 schema 2 로 올리고 경영일지를 먼저 고친다(경영일지는 schema 1 만 읽고, 다른 값이면 그 날을 건너뛴다).

## 운영
- 실행: `venv/bin/python export_news_json.py [--dry]` (VPS 카페봇 폴더). 로그 `news_json.log`.
- 정기 실행(크론 `15,45 7-23 * * *`)은 belie 승인 후 등록 — 2026-10-26 현재 **수동 1회 실행만** 됨(11일치).
- 되돌리기: `/var/www/policy-news/data/` 삭제 + 스크립트 삭제. 경영일지는 빈 목록으로 산다.
