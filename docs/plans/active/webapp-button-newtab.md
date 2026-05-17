---
slug: webapp-button-newtab
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 관리자/트레이너 메뉴의 [웹앱 →] 버튼을 시트 버튼처럼 새 탭에서 열기
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: AdminUserPicker.pick(), TrainerCohortView.pick()

# webapp-button-newtab

## 사용자 요청 (2026-05-17)
"관리자, 트레이너 메뉴 → 웹앱 버튼 누르면 시트처럼 새창에서 열리게 해줘"

## 변경
- `AdminUserPicker.pick()`: `router.push("/dashboard")` → `window.open("/dashboard", "_blank")`
- `TrainerCohortView.pick()`: 동일 변경, 사용하지 않게 된 useRouter 제거
- impersonation cookie 는 그대로 set (서버에서 새 탭 요청 받을 때 적용됨)

## UX
- admin/users 또는 /trainer 탭에서 [웹앱 →] 클릭
- 새 탭 열리며 그 수강생 dashboard 표시
- 원래 admin/trainer 탭은 그대로 유지 (impersonation cookie 는 공유되지만 admin/users 페이지 자체는 getSessionEmail 기반이라 정상 노출)

## Acceptance
- [ ] [웹앱 →] 클릭 → 새 탭 + 그 수강생 dashboard
- [ ] 원래 탭 그대로 유지
- [ ] check.sh 통과
