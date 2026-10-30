## 2026-10-30 · 트레이닝일지 — 수강생마다 자기 일지만 (노션 A안)
- feat/training-log-own-only. belie: 노션 「[N기] 세일즈PT 수강생 트레이닝 피드백」 전체가 아니라 각자 자기 일지만. A안(서버가 노션을 읽어 앱 안에서 내 것만) 승인.
- 변경: notion-client(repo, 읽기만) · training-log 서비스(기수 DB 자동 검색·이름 판정·본문 재확인) · API 2개 · /training-log 화면 · PC 업무도구 항목 · middleware 보호 경로 · components.md.
- 노션: YJ그룹에서 belie 계정은 내부 연결 생성 권한 없음 → belie 선택으로 개인 액세스 토큰 「에고라이트」. 토큰 생성·서버 등록(`NOTION_TOKEN`)은 belie 직접(대화·커밋에 값 없음).
- 검증: 합성 시험(남의 것·다른 기수·일지 아닌 표 거절), 합성 화면(375px 목록·본문·빈 상태). 실제 노션 연결 확인은 토큰 등록 후.
- 되돌리기 = squash revert. 토큰 폐기는 노션 개발자 도구 → 개인 액세스 토큰.
