> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 주민등록번호 칸을 13자리로 넓힌다(ADR-0035).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: rrn-front · CompanyInfo · CompanyInfoField · 시트 미러
> - **읽고 나면 알 수 있는 것**: 바꾼 곳 / 확인 / 되돌리기
> - **관련 문서**: [ADR-0035](../../decisions/0035-rrn-full-digits.md)

# 주민등록번호 13자리 (2026-10-23)
- belie 요청 「주민번호란 뒷자리 작성가능하도록」 → 결정 「13자리 그대로 저장·표시」.
- 바꾼 곳: `normalizeRrn`/`sanitizeRrnTyping`(util), CompanyInfo transform, 편집기 칸·안내 문구, 04 코덱·이월·보관 탭, OCR diff(앞자리 같으면 덮지 않음).
- 확인: 단위 시험(정규화·입력·이월·OCR diff), check.sh.
- 되돌리기: ADR-0035 §되돌리기.
