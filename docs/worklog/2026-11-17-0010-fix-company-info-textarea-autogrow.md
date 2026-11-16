# 2026-11-17 · fix: 업체정보 여러 줄 칸이 내용만큼 늘어나게

- 목표: belie 「기대출 개인·사업자 대출·기타메모 등 내용이 늘어나면 자동으로 필드가 늘어나게, 업체정보가 있는 모든 탭에서」. 계획 [company-info-textarea-autogrow](../plans/completed/company-info-textarea-autogrow.md).
- 원인: 높이를 줄바꿈 개수(rows)로만 정해, 줄바꿈 없이 길게 적어 접힌 줄은 칸이 안 늘고 안에서 스크롤됐다.
- 변경: `CompanyInfoField` 여러 줄 칸에 `useAutoGrow`. 모든 화면이 이 부품을 써서 한 곳 수정. 담당 파일: `components/company-info/CompanyInfoField.tsx`.
- 추가(같은 날 belie 「아래 테두리를 잡고 늘리고 줄일 수 있게, 더블클릭하면 최소·최대」): 칸 아래 손잡이 `ResizeGrip`. 최소 = 그 칸에서 잰 두 줄 높이(글자 배율에 따라 px 이 달라 고정값을 쓰지 않는다), 정한 높이는 저장하지 않음.
- 검증: company-info-autogrow 시험, 실제 브라우저 입력 확인(합성 값), `bash scripts/check.sh`.
- 위험·복구: 표시 전용. 되돌리면 이전 높이 규칙.
