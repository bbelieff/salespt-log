> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 2뎁스 상세·업체정보의 글자 크기 3단계 [− 가 +] 버튼 설계와 검증.
> - **누가 읽나요**: 개발자, 디자인
> - **어떤 기능·작업과 연결?**: `components/FontScaleControl.tsx`, `lib/util/font-scale.ts`, `tailwind.config.ts` fontSize, ContractRow·CompanyInfoEditor
> - **읽고 나면 알 수 있는 것**: 어떻게 글자만 커지나 · 어디에 버튼이 있나 · 되돌리는 법
> - **관련 문서**: `docs/design/tokens.md` 폰트 크기, `docs/design/components.md`

# 글자 크기 단계 (2026-09-29, belie)

## 요청
"글씨가 조금 더 컸으면" 의견. 브라우저 배율 110% 에서도 화면이 깨지지 않게 [− +] 로 지금 기준 세 단계 크게.
범위(belie 후속): 실무/수납 2뎁스 박스 안 정보 중심 + 업체정보 컴포넌트엔 꼭 +−.

## 설계
- 글자만 키운다: 모든 글자 토큰 = `calc(크기 × var(--font-scale, 1))`(Tailwind fontSize·줄 높이, globals.css font-size).
  여백·칸 너비(spacing)는 rem 그대로라 배치가 유지된다. CSS `zoom`·루트 font-size 변경은 배치까지 키워 깨지므로 쓰지 않았다.
- 임의 픽셀 글자 230곳(`text-[11px]` 등, 원래 규칙상 금지)을 토큰 `text-px-N` 으로 일괄 교체 — 그래야 배율이 곱해진다.
  CSS 로 임의 클래스를 덮는 방식은 반응형 변형(`pc:text-sm`)을 이겨 버려 버렸다.
- 버튼 두 곳: 2뎁스 상세 상단(`--font-scale` + `--font-scale-box`), 업체정보 헤더(`calc(var(--font-scale-box) × 자기 단계)`,
  편집 팝업 포털에도 자기 단계). 단계 1·1.1·1.2·1.3, 이 기기 localStorage 에 범위별로 저장.
- 상세 박스의 10px 글자 5곳(할일 날짜·종류 배지, 진행률 눈금, 서류 체크 라벨)은 기본을 11px 로.

## 검증
- `tests/structural/font-scale.test.ts`(임의 픽셀 글자 금지·토큰 배율·globals), `tests/components/font-scale-control.test.ts`.
- 운영: 상세 박스·업체정보 각 단계 화면 확인(스크린샷).

## 되돌리기
squash revert. 저장값은 브라우저 localStorage 뿐(서버 데이터 없음).
