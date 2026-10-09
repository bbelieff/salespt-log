---
status: completed
slug: deploy-build-peak-memory
created: 2026-10-09
owner: belie
completed: 2026-10-09
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 배포 빌드 힙 한도를 3072 로 올리지 않기로 하고, 대신 매 배포 빌드의 피크 메모리를 로그에 남긴다.
> - **누가 읽나요**: 개발자, 운영자
> - **어떤 기능·작업과 연결?**: `.github/workflows/deploy.yml` 빌드 단계, `tests/structural/build-memory-guard.test.ts`
> - **읽고 나면 알 수 있는 것**: 왜 힙을 안 올렸나 / 빌드 피크 메모리는 어디서 보나
> - **관련 문서**: docs/playbooks/deploy-vps.md §0, docs/worklog.md 2026-10-09

# 배포 빌드 피크 메모리 기록

## 배경
- run 37808444078(#1102)·37814981429(#1104) 빌드가 `--max-old-space-size=2048` 에서 힙 OOM. 지점 = next build 린트·타입검사.
- #1105 가 배포 빌드에서 그 단계를 생략(CI check.sh 가 같은 검사 수행) → 이후 배포 2연속 성공.

## 결정
- 3072 상향 보류: 실측 가용 RAM ~2.3GB, 스왑 1.5GB 사용 중. 3GB 힙은 스왑으로만 충당 → 느려지고 전역 OOM 위험.
- 대신 `/usr/bin/time -f build_peak_rss_kb=%M,elapsed_s=%e` 로 피크 RSS 를 매 배포 로그에 기록.

## 할 일
- [x] deploy.yml 빌드 측정 래핑 (원격 스크립트 홑따옴표 금지 유지)
- [x] 구조 테스트 갱신
- [x] playbook·worklog 기록
- [ ] 머지 후 배포 로그에서 `build_peak_rss_kb=` 값 확인
