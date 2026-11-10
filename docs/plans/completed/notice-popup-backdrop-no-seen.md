> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 새소식 팝업 배경을 스치면 공지가 「읽음」으로 영구 처리되던 것을, 배경·Esc 는 닫기만 하게 바꾼다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/announcements/NoticePopup.tsx` · `AnnouncementsGate.tsx`
> - **관련 문서**: [components](../../design/components.md)

# 새소식 팝업 — 배경 탭은 닫기만 (2026-11-10)

## 목표 (belie 2026-11-10, UI 점검 보고서 1-4 「진행」)
스크롤하다 배경을 탭하면 한 번만 보이는 공지가 읽음으로 기록돼 다시 안 떴다. 대화상자 표시·Esc·초점 이동이 없고 ✕ 가 약 24px.

## 수용 조건
1. 배경 탭·Esc = 닫기만(기록 없음). 다음 접속 때 다시 뜬다.
2. ✕·[확인]·「사용 가이드」·「지난 업데이트」 = 지금처럼 본 것으로 기록.
3. role=dialog·aria-modal, 열리면 팝업에 초점, 닫히면 원래 자리로. ✕ 누르는 영역 44px.

## 검증
- `tests/components/notice-popup-dismiss.test.ts` 4건 + 기존 새소식 시험, tsc.
- 실제 화면은 배포 뒤 사용자 확인.

## 되돌리기
squash 커밋 1건 revert. 화면만.
