# desktop-fluid-20260925 — 학생 PC 전폭 셸

측정: production 1920x1080에서 사이드바 224px + 본문 `PageContainer pc:max-w-6xl`(972px)
중앙 정렬, 문서 높이 1245px. ~700px 수평 여백 낭비.

## 결정

- `PageContainer width="fluid"` 신설: `md:max-w-2xl pc:max-w-none`, 거터 `md:px-4 pc:px-6`
  고정(`wide:px-8` 확장 없음). 모바일·태블릿은 wide와 동일.
- `TopHeader`는 admin/trainer 공유라 코드상 `width="wide"` 유지. 학생 셸 전폭은
  `app/globals.css` `.desktop-shell` 스코프(≥1024px)가 해제:
  `.desktop-glass-header > div`, `.page-banner > div`(신설 훅),
  `.weeklygoal-main > div`, `.week-nav-row`(컨택·일정 WeekHeader 신설 훅).
  전역 max-w 오버라이드 금지.
- 대시보드 ≥1600px: 생산성|주간목표|퍼널 3열. 래퍼 `min-[1600px]:contents`로 DOM 순서
  유지. 1024~1599는 기존 2열, 모바일 stacked.
- DB·컨택 ≥1440px: `minmax(0,1fr)` 2열 워크스페이스(레이아웃 래퍼만). 채널 선택·날짜→
  채널→입력 순서, 클릭 수, 마운트 유지 무변경. 목록 자연 스크롤, 고정 높이 없음.
- 일정·캘린더·수납 기존 멀티컬럼 유지, stray 캡 제거. 수납 구
  `min-[1440px]:max-w-none` 특례는 fluid로 대체(삭제).
- 하단 spacer는 `pc:pb-6` 오버라이드만(모바일 safe-area 보존, TabBar `pc:hidden` 유지).
- 주간목표 학생 본문 `pc:max-w-none` + `pc:px-6`. 트레이너 보조 화면(셸 없음) 무변경.

## 비목표

- auth/API/서비스/config 마이그레이션 없음. DB·계산·자동저장·dirty 가드·접근성 무변경.
- 글래스 스타일·PC 13.5px 밀도 무변경. `overflow:hidden` 클리핑·고정 높이 압축 금지.
- 전체 콘텐츠 no-scroll 보장 없음(긴 목록은 자연 스크롤).

## 검증

- `npx tsc --noEmit` 통과.
- `tests/components/desktop-fluid.test.ts` 35개 통과(스코프 계약·전폭·순서·spacer·
  차트 훅·셸 여백. 구 주간목표 `pc:max-w-none` 포함 단언 1건은 버그 내장이라
  부재 검증으로 교체).

## 실측 반영 2차(1920x1080)

- 차트 훅 + 셸 스코프 max-height(퍼널 220·추이 260·도넛 160, meet·무클리핑).
  개요 `items-start`·`flex-none` 자연 높이. 대시보드 `pc:min-h-0`·학생 주간목표 셸 최소 높이 해제,
  레이아웃 중복 탭바 여백 제거(`.app-shell-main`). 주간목표 공용 `pc:` 클래스
  제거(셸 스코프가 학생 전폭·거터 담당, 트레이너 원본 유지). DB 2열은
  `activeCh !== null` 조건. 목표: 대표 1920x1080 개요+차트 ≤1080, 긴 PT과제는
  자연 성장.
- 기존 `desktop-glass-shell`(15)·`top-header-regression`(26) 등 146개 통과, 스킵 2.
  `build-memory-guard` 1파일 실패는 격리 워크스페이스에 `.github/`가 없어서(기존 환경 결함).
- 브라우저 실측(390/1024/1280/1440/1920/2560)은 코디네이터 담당.

## 통합 화면 검증

- 위 여섯 폭에서 실제 컴포넌트에 합성 데이터만 넣어 전 탭 가로 넘침 없음 확인.
- 대시보드 1600px 전환 경계 추가 확인. 1920×1080에서 전체 요약과 차트 표시, 문서 높이 1080px.
- DB 채널 전환 후 이전 폼의 hidden/display:none 유지, 선택 채널 폼만 노출. 모바일 하단바·입력 순서 유지.
- 공유 주간목표 Content의 최소 높이·하단 여백도 `.desktop-shell .weeklygoal-main` 안으로 이동해 트레이너 화면 보존.
- 긴 목록/수납 상세와 낮은 화면은 자연 스크롤한다. 데이터 생략·일괄 글자 축소·컨테이너 클리핑 없음.
