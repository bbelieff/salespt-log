# ADR-0015: 시트 복제·폴더 생성은 관리자 OAuth (SA 용량 0 회피)

- Status: accepted
- Date: 2026-06-10
- Related: ADR-0011(drive copy), ADR-0012(folder create), ADR-0014(arena registry)

## Context

아레나 일괄 생성(`create-arena-members`)이 `copyTemplateSheet`(files.copy)·`createFolder`
(files.create) 를 SA(masterbot)로 수행하다 **"The user's Drive storage quota has been
exceeded"** 로 실패.

실측 진단(SA 자격):
- masterbot storageQuota.limit = **0** (서비스 계정 기본).
- 템플릿(1OcZed)·시트폴더(1L5LhWe)·업체부모(1r6W5SP) 모두 `driveId` 없음
  = **belie My Drive 공유 폴더**(Google 공유 드라이브 아님).

My-Drive 공유 폴더에 SA 가 파일을 만들면 새 파일의 **소유자가 SA** 가 되고, SA 용량이
0이라 생성 실패. (공유 드라이브라면 드라이브가 소유 → 무관하지만, beliefkimkim@gmail.com
은 소비자 계정이라 공유 드라이브 생성 불가.) 기존 동작이 멀쩡한 이유: 편집(values 쓰기)은
용량을 소비하지 않음 — **파일 생성만** SA 로 불가.

## Decision

**파일 생성(복제·폴더)만 관리자(belie) OAuth 로 수행한다.**

- `drive-client.ts:driveCreatorClient()` — `ADMIN_DRIVE_REFRESH_TOKEN` 있으면
  belie OAuth2(`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` + refresh token, scope `drive`)로
  Drive 클라이언트 구성. 없으면 SA `driveWriteClient` 폴백(+경고; 공유 드라이브 한정 동작).
- `copyTemplateSheet`·`createFolder` 만 이 클라이언트 사용 → 새 파일은 **belie 소유**
  (용량 있음). 폴더(1L5LhWe 등)가 SA 와 공유돼 있어 생성된 파일은 권한 상속 → SA 가
  이후 편집/조회 가능(writeProfile·앱 읽기 정상).
- 그 외 모든 Drive/Sheets I/O 는 SA 유지(읽기 `drive.readonly`, 편집 values API).
- refresh token 발급: `scripts/get-admin-drive-token.mjs` (loopback `localhost:5858`,
  offline+consent). 선행: GCP OAuth 클라이언트에 리디렉션 URI 1회 등록.

## Consequences

- 로그인 OAuth 스코프는 **불변**(수강생 영향 없음). Drive 권한은 별도 토큰(belie)만 보유.
- `ADMIN_DRIVE_REFRESH_TOKEN` 은 belie Drive 전체 접근 권한 = 1급 비밀. `.env.local`/VPS
  env 에만 저장(시트·레포 금지). 유출 시 belie GCP 콘솔에서 토큰 revoke.
- 토큰 미설정 시 생성은 실패(명시 경고) — 조회·편집 등 SA 경로는 영향 없음.
- 대안(공유 드라이브 이전)은 Workspace 필요 → 소비자 계정 불가라 본 결정 채택.
