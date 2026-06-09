/**
 * Layer: config — 경영일지 복제 **마스터 템플릿** SSOT (로직 없음, client-safe 상수).
 *
 * 아레나/신규 기수 생성 시 복제 원본의 기본값. cohorts 탭 E(templateSheetId)가 비어
 * 있으면 이 값이 쓰인다. UI 입력도 이 값으로 prefill.
 *
 * ⚠️ 템플릿 변경 시 **이 한 줄만** 고친다 (코드/문서 하드코딩 금지 — Hashimoto SSOT).
 *
 * 현행: "★★★세일즈PT_ 수강생 경영일지 양식(0605ver)" — 콜·지·기·소 계약 수식 fix(#319) 반영본.
 * deprecated: 1nx1EufkFFGaf5dp-8Dp2GvX0jU_P4EUe8QEMKTPM_rY (구 양식, 앱테스트용 — 복제 원본 금지).
 */
export const DEFAULT_COHORT_TEMPLATE_ID =
  "1OcZedEkncMDD5mcseQmQkJJMEQQ_zuimyUsIBaNnmIE";
