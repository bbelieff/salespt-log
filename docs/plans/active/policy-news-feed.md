> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 맞춤공고 2단계 — 정책자금뉴스를 공고별 JSON 으로 받아 경영일지가 읽는다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 핸드오프 §7-2, 다음 3단계 매칭
> - **읽고 나면 알 수 있는 것**: 무엇을 만들었나, 무엇이 남았나
> - **관련 문서**: docs/domains/policy-news-feed.md

# 맞춤공고 2단계 — 공고 JSON 계약 (2026-10-26)

## 한 것
- VPS: `export_news_json.py`(staged xlsx → data/<날짜>.json·index.json, 읽기 전용·유출 검사·45일 보관). DRY → 실행 1회, 11일·평균 22건, `/news/data/index.json` 200 application/json, `/news/latest` 200 유지.
- 경영일지: `lib/types/policy-news.ts`(Zod, schema 1) · `lib/repo/policy-news.ts`(fetch 30분 캐시, 실패 시 빈 목록) · `lib/analytics/policy-announcement.ts`(id·지역 범위·마감 읽기·여러 날 합치기) + 합성 시험.

## 남은 것
- [ ] VPS 크론 등록(`/etc/cron.d/salespt-news-json`, 30분마다) — 자동 승인 검토가 「지속 설정」으로 막음 → belie 승인 필요. 그 전까지 데이터는 2026-10-23 까지만.
- 실데이터 점검(10-26): 11일 250줄 → 공고 38건, 지역 못 읽음 0, 마감 날짜 24·예산소진 13·상시 1.
- [ ] 3단계 매칭 함수(지역 + 소상공인 + 제외 업종, 나머지 「확인 필요」).

## 되돌리기
squash revert 1회(경영일지는 아직 아무 화면도 이 피드를 안 쓴다). VPS 는 data/ 폴더·스크립트 삭제.
