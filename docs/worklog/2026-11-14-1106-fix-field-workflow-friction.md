## 2026-11-14 · 경영일지 현장 입력·조회 불편 수정

- 브랜치 fix/field-workflow-friction. 기준 master 1baa031f6fc4f7cbd006cfcbfa567f77fc2ac70d. [검증 계획](../plans/active/field-workflow-friction.md).
- DB정보는 컨택완료로 표시만 변경. 재통화·저장값·STEP 2 집계 불변. DB관리 계약업체 칩은 기존 서버 계약 투영으로 목록만 필터링.
- Android는 일반 파일 선택기, 기존 녹음 14MB 한도 및 파일 검증 유지. 갤럭시 실기기·운영 업로드는 별도 검증.
- 실무수납 진행건은 TodoSection/TodoRow 및 해당 단위검사, 일정계약은 BoardPopover 및 회귀검사를 분리해 구현. 하단 PC 창은 자식 폼이 커질 때 화면 안에 재배치. 시간값·저장·일정 시간축 불변.
- 합성 Chrome PC 1280 / 모바일 320·375·430: 8개 칩, 계약 단독, 모두 선택, 컨택완료 표시 및 기존 저장값 단언 PASS. 가로 넘침·쓰기 요청 0. 결합 검사 전 집중 Vitest에서 결제·일정 23건 PASS.
- 개별 수강생 투두 운영 조회는 이 코드 변경에 포함하지 않음. 운영 데이터·시트·권한 변경 0. 전체 check, build, 독립 검수, 자동 배포는 PR에서 정확한 결과를 연결한다.
