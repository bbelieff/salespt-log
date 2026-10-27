# DB 가져오기 입력 경계 점검
- 사용자 2026-10-22: 첫 줄을 비우거나 다양한 방식으로 붙여넣어도 첫 실제 텍스트부터 올바르게 인식하도록 시스템 점검.
- base d55057fed6c5ccfe64d93f742faaaf1faea8fbb2, fix/db-import-input-boundaries 전용. 이전 작업본·완료 기록 보존.
- root 소유: 가져오기 입력 전처리/실패 재현 평가 및 필요한 기존 파서 경계. API·DB·계정별 저장/집계 정책·신뢰도 확대 변경 없음. 모든 fixture 합성.
- 수용: 일반/공백/Unicode 빈 줄 뒤 제목 또는 첫 고객을 보존, CSV/TSV/세미콜론·LF/CRLF/CR·따옴표 안 줄바꿈을 구분. 열 앞 빈 칸 유지. 파일과 텍스트 동일 분석. 모호한 값은 질문 유지. 깨진 구조는 설명하고 저장 차단.
- RED 가능한 실제 analyzeImport/readImportFile 평가 → 좁은 수정 → 기존 가져오기/보안/모의 저장 회귀 → 필요 전체 gate/독립 검증/CI/운영 확인. 실제 수강생 원문 대조 대기는 이전과 동일.

## 재현 및 수정
- 최초35개 합성 평가 중19실패: NBSP/전각/ZW 공란 첫줄, CR-only, 메모 내부 라벨 오인, 인용제목 구분자 오인, UTF16 공란 앞줄. 추가42사례 중 quoted-empty/멀티라인 첫제목/첫 미완성 quote 3실패를 재현.
- import-text helper에서 둘레 빈 줄만 정리하고 CR/CRLF→LF. 첫 비어있지 않은 논리행·구분자·시작 위치를 반환. 따옴표 안 구분자는 세지 않으며 실제 데이터 내부 제어문자는 삭제하지 않음.
- adaptive/model.delimited/importHeaders가 같은 실제 첫행·위치 사용. 앞 빈 열 보존, 메모 안 라벨로 형식 전환 방지, 첫 CSV의 깨진 따옴표는 안내 후 차단. 원문/애매한 항목 질문·계정별 규칙·저장/집계는 유지.
- 검증자가 찾은 다른 구분자만 있는 앞 빈 행(;;; 뒤 CSV 등) 불일치도 교차51개 사례로 회귀. 도구/의존성 준비 오류와 제품 RED를 구분함.
- 최종 집중: 신규51+기존80=131 PASS, tsc --noEmit PASS. 전체 hook/CI build/정확한 head 독립 검증·운영 확인은 진행 중.
- 프로덕션 ImportDialog를 격리한 브라우저에서 NBSP 앞빈줄+CSV의 메모 내 대표자 문구를 올바른 1건으로 배치·공급처 입력 뒤 추가 활성 확인. 최종 head의 모의 저장 확인은 이후 수행. 운영 고객 시험쓰기 없음.
- 최종 head17b3234e4868992e24bda52e68429f6606801223/treecd016138c10ee842b3feaa82e622cfcace2672a9. 정상 hook check95+4217=4312 PASS, 기존45skip·타입/린트/크기/docdrift PASS, 같은 head 독립 검증 PASS.
- 최종 head 프로덕션 컴포넌트/CSS 합성 브라우저: NBSP 빈줄+;;; 빈행 뒤 CSV+메모 속 대표자 문구 → 올바른1건·공급처 입력·추가 활성·모의onApply 완료. PC CSS1280에서 dialog좌우50~1230(폭1180), 모바일320/375/430 각각 문서너비 동일·1행. 모바일430에서 완료 출력의 업체/전화010-0000-2001/날짜/공급처 확인. 운영 쓰기0.
- 브라우저 DOM의 전화값 비교는 도구의 마스킹 영향으로 직접 검증 근거에서 제외하고 실제 화면·모의 저장 출력으로 확인. PC PNG는 캡처 도구가 오른쪽을 자르는 한계, 모바일375 PNG는 전체 확인. 서버/탭/임시 viewport 정리.
- PR#1188, CI39646317632 build/check 진행 중. actual 학생 원문 대조는 아직 미수신.
- #1188 squash2e6e12087232d9cfe0c2ceaa5eade7dde27a42a5 병합. CI39646317632 check/build·GitGuardian PASS. 운영 배포 확인 중.
- 운영 완료: #1188 merge2e6e12087232d9cfe0c2ceaa5eade7dde27a42a5, Deploy39647086934 success, master QA39647086830 success. root/health200·buildzjA8sa8NppDnxoWqTiNc9·새page-5450d60ba0df8c52.js200과 firstRecord/offset/unterminated helper 확인.
- 운영 가져오기 창: ZW빈줄+;;;빈행+CRLF CSV·메모 속 대표자 문구가 사업자명/대표자/전화/날짜 정상1건. 미완성 첫 CSV 따옴표는 안내 후 입력 단계 유지. 추가 없이 닫음(운영 쓰기0). screenshot artifacts/db-import-boundaries-production.png, live-proof.json.
- 새 경계51개 및 기존80 집중검사 통과는 결정적 parser 평가이며 실제 모든 자료의 인식률이나 모델 정확도 수치가 아니다. 임의 안내문/불명확 값은 고객 정보일 수 있으므로 무조건 삭제·확정하지 않으며 기존 확인 단계 유지. 원본 수강생 원문 미수신으로 동일 사건 대조는 NOT_RUN.
