## 2026-10-31 · 실무진행 개수 제한 없애기
- feat/payment-unlimited-work-items. belie: 「실무진행 3개까지밖에 안 됨. 무한으로」.
- 변경: `ContractPayment.추가진행`(진행 4번부터, DB JSONB) · contract-slots 번호 헬퍼 · 매출(periodRevenue·대시보드·배지·주간 요약·해지 전액) · 오늘 챙길 일·업무 현황·기관 보기·목록 카드 · 할 일 번호(Q 칸·API) · 내보내기 · ContractSlots/PaymentSlotForm(색 되풀이) · data-model/sheet-structure/components.
- 시트를 정본으로 읽는 옛 기수는 진행 4번부터 저장 거절(「이 기수는 진행건을 3개까지」). 시트 백업에는 1~3만.
- 검증: 단위·합성 화면(진행 4 표시, 5·6 추가, 저장 payload 에 추가진행). 운영 데이터 변경 없음(필드 추가만).
- 되돌리기 = squash revert. 되돌리면 이미 저장된 진행 4번부터는 화면에서 안 보이지만 DB payload 에 남는다(다시 배포하면 돌아옴).
