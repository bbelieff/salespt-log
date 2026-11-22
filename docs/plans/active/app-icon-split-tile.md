> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 앱 아이콘·파비콘을 r4-06 「반반 타일(더 둥근 판·큰 $) + 반전 그림자」로 바꾸는 작업 계획.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `app/icon.svg`, `app/apple-icon.png`, `public/icons/*`, `components/desktop/SideIdentity.tsx`
> - **읽고 나면 알 수 있는 것**: 어떤 파일이 어떤 자리에 쓰이는지, 어떻게 다시 만드는지, 되돌리는 법
> - **관련 문서**: [favicon (완료)](../completed/favicon.md), [PC 머리줄 한 줄](pc-header-one-row.md)

# 앱 아이콘 r4-06 반반 타일

belie 확정(2026-11-22): 처음 「r4-03」 → 다시 보고 「06번이 더 좋다」로 r4-06(모서리 더 둥글게·$ 크게) 최종. 로고 기울기 사선으로 빨강|검정을 나누고, 흰 $ 의 그림자 색을 칸마다 반대로(빨강 칸 위 검정, 검정 칸 위 빨강).

| 파일 | 자리 | 내용 |
|---|---|---|
| `app/icon.svg` | 브라우저 탭 | 둥근 판, 그림자 없음(작은 크기에서 뭉개짐 방지) |
| `app/apple-icon.png` | iOS 홈 화면 180px | 꽉 찬 판 + 그림자 (iOS 가 모서리를 둥글게) |
| `public/icons/app-192.png`, `app-512.png` | 안드로이드·설치 앱 | 둥근 판(투명 모서리) + 그림자 |
| `public/icons/app-maskable-512.png` | 안드로이드 모양 맞춤 | 꽉 찬 판 + 그림자 ($ 는 안전 영역 안) |
| `public/icons/mark.svg` | PC 사이드탭 접힘 아이콘 | `app/icon.svg` 와 같음 |

- 옛 `app/icon.tsx`·`app/apple-icon.tsx`(글꼴 $ 를 그리던 코드)는 지움 — 정적 파일이 더 또렷하고 빌드도 가벼움.
- PNG 는 SVG 원본을 sharp 로 변환해 만들었다(시안 r4-06 tile/favicon SVG).
- 확인: 생성 PNG 를 원본 크기·16/32px 확대로 눈으로 대조. 실제 폰 홈 화면 설치는 배포 뒤 belie 확인.
- 되돌리기: squash revert 1번.
