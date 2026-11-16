# 업체정보 여러 줄 칸 — 정한 높이 기억

- 목적: belie 2026-11-17 「칸마다 정한 높이 기억하게 해줘」. 앞 작업 [company-info-textarea-autogrow](company-info-textarea-autogrow.md) 의 후속. 관련: [components](../../design/components.md) CompanyInfoField.

## 수용 조건
- 손잡이로 정한 높이는 칸 종류(기대출 개인·사업자 대출·기타메모 …)마다 따로 기억하고, 화면을 나갔다 오거나 다른 업체·다른 탭에서 열어도 그 높이로 나온다.
- 두 번 눌러 최대(내용 전체)로 되돌리면 기억을 지우고 자동 높이로 돌아간다.
- 기억은 이 기기(브라우저)에만 둔다 — 서버·시트 저장 없음. 저장소를 못 쓰는 브라우저에서도 조절은 그대로 된다.

## 변경
- `components/company-info/CompanyInfoField.tsx`: `loadFieldHeight`·`saveFieldHeight`(localStorage `ci-field-height:<칸>`), 그린 뒤 읽어 적용.

## 검증
- `tests/components/company-info-autogrow.test.ts`(기억·복원·지우기·망가진 값), 실제 브라우저 확인(합성 값), `bash scripts/check.sh`.
