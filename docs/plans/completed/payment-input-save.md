# 실무/수납 진행건 입력 중 저장 방해 제거

- 목적/독자: 입력을 마칠 때 저장하도록 고치는 개발·검증 계약.
- 사용자 요청: 2026-10-20 기존 글자 단위 저장 불편의 해결 요청. 기존 모양을 유지하는 동작 수정이며 직접 수정 범위로 진행한다.
- base: fda90c4b439b4ef614365a23c4eff43868a2540a (#1185 포함). 앞선 작업의 조용한 저장 피드백·업체정보·portal 경계를 보존한다.
- 작성 소유: ContractRow.tsx, PaymentSlotForm.tsx, 관련 합성 React 회귀시험. 공용 useAutosave/API/DB/업체정보 저장 엔진은 변경하지 않는다.
- 변경: 진행기관·진행상품·현황·진행 메모·로드맵·계약 비고는 draft에만 적고 해당 칸 blur에서 직렬 저장. 진행률·서류 체크 선택의 기존 자동저장 유지. 기존 실패/재시도/되돌리기·이탈 보호 유지.
- 수용조건: 한글 조합/천천히 입력/긴 멈춤에서도 입력 중 요청 0, 칸 이동 후 최종값 저장, 늦은 ACK가 다음 입력/커서를 덮지 않음, 실패 초안 유지와 명시 재시도, 업체 전환의 저장 대상 보존. 합성 데이터만 사용한다.
- 검증: 실제 ContractRow → 실제 PaymentSlotForm → 실제 useAutosave/queue를 mount하고 외부 네트워크 경계만 모의. RED 재현 후 수정, 관련 회귀 → 정상 commit hook 전체 check → production build → 다른 검증자의 exact head 검토 → CI/security → 직렬 배포/공개 health/안전한 live 확인.
- 미확인: 실제 OS 한글 IME·고객 데이터 시험쓰기는 NOT_RUN. 합성 composition 이벤트와 실제 입력 컴포넌트의 저장 호출을 구분해 보고한다.
- 복구: 이 PR의 UI 저장 배선만 정상 revert. 데이터/스키마 변경 없음.

## 완료 — 2026-10-20
- PR1186, reviewed92d7fe36/tree105c833d, squash3c463a05. 정상 hook 구조95/동작4156+45skip PASS, 독립 검토·공식 CI check/build PASS. Deploy39395189301 및 master QA39395189310 SUCCESS. root/health200·새 served build/실무수납 JS 확인. 상세 증거는 PR 영수증 댓글 정본.
- 실제 OS IME·운영 고객 시험쓰기 NOT_RUN. 합성 PC1280/모바일375 동작 확인, 검증 자원 종료.
