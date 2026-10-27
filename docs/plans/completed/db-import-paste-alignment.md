# DB 텍스트 가져오기 열 밀림 진단

- 사용자: 2026-10-22 수강생의 텍스트 붙여넣기 후 잘못 배치·추가 불가 화면 신고.
- base: 3c463a058506f39d09991ff1ded747edce1ca459. 전용 fix/db-import-paste-alignment. 기존 작업/운영 고객 기록 보존.
- root 소유: adaptive-import.ts 및 가져오기 회귀 시험, 필요 시 ImportDialog의 기존 검증 안내만. model/API/DB 저장·집계·자동 학습 정책 변경은 별도 파급 검토 후 판단한다.
- 원문은 요청 중. 이미지의 실제 이름·전화번호·사업자번호는 fixture나 로그에 넣지 않는다. 합성 업종/지역/사업자번호가 잘못된 칸으로 밀리는 사례를 먼저 구성한다. 수강생 원문과 정확히 동일한 재현으로 단정하지 않는다.
- 수용조건: TSV 앞 빈 열 유지, 첫 고객 보존, 빈/공란 표시 행은 DB로 세지 않음, 날짜/전화/사업자번호 안전 배치, 애매한 값은 확인 유지, 원문 보존, 기존 CSV/TSV/XLSX·양식 기억·중복 경고·유입 선택 회귀 없음.
- 순서: 합성 RED → 원인 구분·좁은 수정 → 기존/새 평가·실제 가져오기 UI 모의 저장 → 정상 hook/check·production build·다른 검증자의 exact head PASS·CI → 승인 범위 배포/새 served 코드 확인. 고객 데이터 시험쓰기 없음.
- 미확인: 수강생이 붙여넣은 원문이 없어 사건의 정확한 원인과 원문 재현은 대기 중.

## 진단·수정 및 검증
- 합성 RED 5건: TSV 앞 빈 열을 trim()이 제거하여 제목행만 이동. 사업자명/대표자/전화번호에 업종/지역/사업자번호가 잘못 배치됨.
- 수정: 둘레의 빈 줄만 제거하고 TSV 열 유지. 전체가 공란 표시인 행은 파싱 후 제외하여 뒤 고객과 원문·질문 위치를 보존.
- 기존 검증/추가 규칙은 유지. 선택한 행의 노란 칸·필수 정보·중복 확인 중 추가를 막는 이유만 하단에 명시.
- 집중 시험: 새 파서 8, 실제 ImportDialog 모의 저장 2, 기존 adaptive 15 PASS. 기존 evaluation 25와 rules UI 1도 앞선 실행 PASS. tsc --noEmit PASS.
- 실제 컴포넌트·CSS·운영 공개 기본 CSS/폰트 재사용, 모의 onApply로 격리한 브라우저: 앞 빈 열/공란 행 사례 정상 배치 → 애매한 사업자번호 확인 → 공급처 입력 → 추가 가능. PC CSS 1280 및 모바일 CSS 375에서 안내 확인, 모바일 실제 키보드 날짜 입력 후 모의 추가 완료. 자동화 date fill만으로 React 변경이 반영되지 않아 키보드 입력으로 확정. 운영 고객 저장 시험 아님.
- 화면 증거: 로컬 artifacts/db-import-alignment-pc.png 및 db-import-alignment-mobile.png. PC 캡처는 도구 화면 좌표로 우측이 잘린 한계, DOM으로 전체 행/활성 상태 확인. 모바일 문서 너비 375 유지.
- 최종 전체 hook·CI build·정확한 head 독립 검증·운영 배포 확인은 진행 중. 수강생 원문 대조는 별도 대기.
- 최종 head 3035c6cb2c65ec4954936ea1476d72501a6b44ea, tree 9b5c914f24f45f0cfe850bf08b95f672db128fe3. 정상 check.sh 95+4166 PASS/45 기존 skip, 독립 검증 동일 tree PASS. PR #1187 / CI 39639793474 production build 진행 중.
- CI 39639793474 check/build PASS·GitGuardian PASS. #1187 squash d55057fed6c5ccfe64d93f742faaaf1faea8fbb2 병합. 운영 배포 확인 중.
- 배포 완료: Deploy39640539697 success, master QA39640539523 success, SHA d55057fed6c5ccfe64d93f742faaaf1faea8fbb2. root/health200, build4zBbyi1MsKe71jtNTlVeO, 새 page-eaf4ee0f9d3d41c5.js의 확인 안내·공란 입력 오류 코드200 확인.
- 운영 로그인된 가져오기 UI에서 같은 합성 TSV+공란 표시 행을 붙여넣어 1건·사업자명/대표자/전화/날짜 정상 배치와 하단 확인 사유 확인. 추가 버튼을 누르지 않고 닫음. 운영 기록 쓰기0. 실화면 artifacts/db-import-alignment-production.png.
- 남은 한계: 수강생 원문 미수신으로 실제 신고 원문과의 정확한 동일 재현은 NOT_RUN. 확인된 결함 수정·검증·배포와 원문 대조 대기를 구분한다. 합성 onApply 시험은 운영 DB 지속성 시험이 아님. 타 고객 데이터/기존 잘못된 저장 내용의 정리도 수행하지 않음.
