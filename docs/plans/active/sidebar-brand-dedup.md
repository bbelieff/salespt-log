# 사이드바 중복 로고 제거

- 요청/승인: 2026-10-14 belie가 사이드바 로고를 제거하고 메인 로고만 남기라고 직접 수정 요청. 승인된 운영 반영 범위의 누락 수정.
- 기준: origin/master 22343edb3da075ca69bdb8a806edaf0140f46766.
- 범위: DesktopNav의 로고 이미지 제거. 경영일지 제목·접기/펼치기·모바일 메뉴 유지. 두 상태 헤더 h-16 통일. TopHeader 로고와 계정 메뉴 보존.
- 검증: 정상 check.sh·production build·정확한 PR head CI, 합성 실제 컴포넌트 PC 펼침/접힘과 모바일320/375/430 확인. 운영 배포 success·root/health200·실제 로고 개수 확인.
- NOT_RUN: 아직 검사·배포 전. 운영 DB 쓰기·스키마 변경 없음.
