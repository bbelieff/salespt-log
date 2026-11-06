> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 트레이너관리 권한대로 담당 아닌 활성 수강생도 열고, 트레이너 본인 수강생 페이지(0기 코스텝)를 만들 수 있게 한 기록.
> - **누가 읽나요**: 개발자 · belie
> - **어떤 기능·작업과 연결?**: `lib/auth/identity.ts canImpersonate` · `lib/service/trainer-student-access.ts` · `lib/service/auth.ts claimAccount` · `app/trainer/page.tsx` · `components/auth/TrainerCohortView·TraineeCard`
> - **읽고 나면 알 수 있는 것**: 원인 · 바꾼 것 · 운영 데이터 순서 · 되돌리기
> - **관련 문서**: [작업 기록](../../worklog/2026-11-06-2130-fix-trainer-grant-access.md)

# 트레이너관리 권한 = 실제 열기 권한 · 트레이너 본인 페이지

- 요청(2026-11-06 belie): 박수혁·황의진 트레이너는 트레이너관리에서 「활성 수강생 전부 조회·수정」인데 담당 수강생만 열린다. 0기 GM(관리자 본인 페이지)만 빼고 다 열어 달라. 박수혁 트레이너 본인 페이지(0기 코스텝, 현재 트레이너 메일)를 만들어 수강생 토글에서 자기 것을 쓰게.
- 원인: 수강생 화면 열기(`canImpersonate`)가 담당 칸만 봤다. 트레이너관리 권한(`canAccessManagedStudent`)은 주간목표에만 쓰였다. 트레이너 페이지 카드도 담당에만 [웹앱]을 보였다.
- 변경:
  - `canImpersonate(session, target, op)`: 담당이면 그대로, 아니면 트레이너관리 권한(등급 기본값 ∧ 설정, 활성/아레나/보관 분류)대로. 쓰기 경로(`getWritableUserEmail`)는 write 권한. 관리자 이메일·트레이너 본인 수강생 페이지(0기 GM·0기 코스텝)는 담당이 아니면 열지 않는다.
  - 트레이너 페이지: 「활성 수강생 조회」 권한이면 활성 기수 수강생 카드에도 [주간목표]/[웹앱]. 트레이너 이름은 트레이너 행에서(본인 수강생 행이 생겨도 「코스텝」으로 바뀌지 않게).
  - `claimAccount`: 트레이너도 0기 사전등록 행만은 클레임 가능(관리자 0기 GM 과 같은 길). 다른 기수는 그대로 막힘.
- 트레이너 수강생 토글: 같은 메일에 수강생 행이 있으면 기존 `resolveStudentViewContext` 가 본인 화면(own)으로 연다 — 코드 변경 없음.
- 운영 데이터 순서(박수혁 본인 페이지): ① 관리자 화면에서 0기 「코스텝」 구성원 추가(템플릿 시트 복제·사전등록) ② 박수혁 트레이너가 같은 메일로 로그인 → /claim 에서 기수 0 · 이름 코스텝 ③ 수강생 토글 → 본인 화면, 업체 폴더는 「구글 드라이브 연결」.
- 시험: `tests/auth/trainer-grant-impersonation.test.ts`(5) · 클레임 ②-0 · 트레이너 페이지 mock 갱신.
- 되돌리기: squash revert(데이터 변경 없음).
