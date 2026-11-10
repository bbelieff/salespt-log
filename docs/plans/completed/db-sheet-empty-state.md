> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB 목록이 비었을 때 불러오는 중 / 첫 DB 추가 / 조건 불일치를 나눠 안내한다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/db-sheet/_components/Grid.tsx` · `app/(app)/db-sheet/page.tsx`
> - **관련 문서**: [components](../../design/components.md)

# DB 목록 빈 칸 안내 (2026-11-10)

## 목표 (belie 2026-11-10, UI 점검 보고서 2-3 「좋다 진행」)
처음 들어오면 목록이 오기 전에 「조건에 맞는 업체가 없습니다 · 검색어나 기간을 바꿔 보세요」가 먼저 보였고, 새 수강생은 필터 없이도 같은 문구를 봤다.

## 수용 조건
1. 불러오는 중 = 「DB 목록을 불러오고 있어요」(role=status).
2. DB 0건 = 「아직 DB가 없어요」 + 「첫 DB를 추가해 보세요…」 + 「＋ DB 추가」 버튼(DB 추가 창 열기).
3. DB 는 있는데 걸러져 0건 = 지금 문구 그대로.

## 검증
- `tests/components/db-sheet-empty-state.test.ts` 4건 + 기존 Grid 시험, tsc.
- 실제 화면은 배포 뒤 확인.

## 되돌리기
squash 커밋 1건 revert. 화면만.
