# 인시던트 — 레지스트리 다행 계정 write≠read (Drive 연결 무한루프, 2026-06-22)

> **📄 요약**: `updateCell` 이 이메일 "첫 매칭 행"에 쓰는데 read 는 `pickPreferredUser` 행을 읽어, 다행 계정에서 Drive 연결이 다른 행에 저장 → me 는 미연결로 보여 무한 "연결" 루프.

## 증상
A1-0 테스터 등 **같은 이메일이 레지스트리에 여러 행**(아레나+트레이너+숫자기수)인 계정에서, Drive 연결 후에도 DriveLinkBar 가 계속 "연결" 버튼을 띄움(에러 없음). 무한루프.

## 원인
- `lib/repo/users.ts updateCell()` = 이메일 **첫 매칭 행**(`rows[i]` 최초)에 write.
- `findUserByEmail`/`loadMe` = **`pickPreferredUser`**(트레이너>아레나>숫자>archived) 행을 read.
- 두 행이 다르면 `updateDriveLink`(N/O/P)가 read 안 하는 행에 저장 → me.driveLinkStatus 미반영 → 연결 버튼 무한 노출.

## 조치 (fix/registry-write-preferred-row)
- `pickPreferredRow({user,sheetRow}[])` 순수 헬퍼 추가(user-priority.ts) — `pickPreferredUser` 와 동일 우선순위로 행 선택.
- `updateCell` 이 첫 행이 아니라 **pickPreferredRow 행**에 write(read/write 행 통일). parse 전부 실패 시에만 첫 행 fallback(옛 동작).
- 회귀 테스트: `tests/repo/preferred-row.test.ts` (아레나+트레이너 다행 → write 행 = read 행).

## 후속(선택)
- 레지스트리 동일 이메일 중복행 경고 점검 스크립트(관측가능성).
