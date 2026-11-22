> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 일정 변경한 미팅에서 계약하면 실무/수납 업체명에 「(변경)」이 따라오던 문제를 고치고, 실무/수납에서 업체명을 바로 고치게 한 기록.
> - **누가 읽나요**: 개발자, 에이전트, belie
> - **어떤 기능·작업과 연결?**: `lib/util/reschedule-mark.ts`, `lib/service/contract-payment-add.ts#addFromContract`, `app/(app)/schedule/_lib/contract-fanout.ts`, `app/(app)/payment/_components/CompanyNameEdit.tsx`
> - **읽고 나면 알 수 있는 것**: 「(변경)」은 어디서 붙고 어디서 떼나 · 옛 계약은 어떻게 정리하나 · 업체명은 어디서 고치나
> - **관련 문서**: [components](../../design/components.md)

# 계약 업체명의 「(변경)」 떼기 + 실무/수납 업체명 바로 고치기 (2026-11-22 belie)

## 원인
- 일정·계약 탭에서 미팅 날짜를 바꾸면 새 미팅 업체명 앞에 「(변경) 」을 붙인다(`useMeetingActions.handleReschedule` — 카드 구분용).
- 그 미팅을 계약으로 저장하면 화면이 미팅 업체명을 그대로 장부(02)·업체정보(06)로 보냈다 → 실무/수납에 「(변경) 업체명」.
- 업체명 고치기는 이미 있었지만(`LinkedFieldsEditor`), 접힌 「📑 계약정보」 안에만 있어 찾기 어려웠다.

## 고친 것
1. 계약으로 넘길 때 「(변경)」을 뗀다 — 화면(`decideContractFanout`)과 서버(`addFromContract`) 둘 다. 서버는 미팅을 표시 유무와 상관없이 찾아 연결 미팅 id 를 남긴다.
2. 계약한 미팅 이름에서도 표시를 뗀다(서버, 실패해도 계약은 진행). 장부·업체정보·미팅 이름이 같아야 이름으로 맞추는 곳(수임료 맞추기, 업체정보 읽기)이 어긋나지 않는다.
3. 실무/수납 PC 상세 제목 옆 ✎ 로 업체명을 바로 고친다. 이름이 「(변경)」으로 시작하면 [「(변경)」 떼기] 한 번으로 정리(옛 계약). 폰은 「📑 계약정보 · 업체명」 안의 수정 칸.
4. 계약·업체명 변경 뒤 일정 주간 화면(week)도 새로 읽는다.

## 하지 않은 것
- 이미 「(변경)」이 붙은 운영 계약을 한꺼번에 고치지 않았다(수강생 실데이터) — 각자 [떼기] 버튼으로.
- 일정 변경할 때 「(변경)」을 붙이는 동작은 그대로(일정 화면에서 바뀐 카드를 알아보는 용도).

## 검증
- [x] `tests/util/reschedule-mark.test.ts` 4 · `tests/service/contract-add-reschedule-mark.test.ts` 4 · `contract-fanout` +1 · 기존 `company-archive-write-gate` 통과
- [x] check.sh
- [ ] 화면 캡처(로그인 필요 화면이라 미실행) — 배포 뒤 belie 확인

## 되돌리기
squash revert 1번. 이미 뗀 이름은 그대로 남는다(되돌려도 다시 붙지 않음).
