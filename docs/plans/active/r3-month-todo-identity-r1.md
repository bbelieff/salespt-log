# 월간 일정·할 일 학생 신원 복구

WORK-ID: `SALES-PT-R3-MONTH-TODO-IDENTITY-R1-RECOVER`
담당: WORKER D · 기준: `8cd75745c9ea7d12e297a59a1f860f6a42135f8b`

## 목표와 범위

보존된 후보를 재설계하지 않고 현재 master에 복구한다. 월간 일정과 할 일 API는 서버의 `requireStudentViewContext`로 해석한 학생 이메일과 선택 시트를 서비스에 전달한다. 할 일 쓰기는 기존 `getWritableUserEmail` 정책을 유지하고 두 결과가 다르면 거부한다. 인증/권한 실패는 안정된 401/403 응답으로 반환한다.

승인된 범위는 다음 기존 7개 경로와 이 계획 한 개뿐이다.

- `app/api/meetings/month/[yyyymm]/route.ts`
- `app/api/todos/route.ts`
- `app/api/todos/[id]/route.ts`
- `lib/service/calendar.ts`
- `lib/service/todos.ts`
- `tests/api/trainer-student-context-routes.test.ts`
- `tests/service/student-context-storage.test.ts`

운영 데이터·Sheet·Drive·권한·GCal 정책을 변경하지 않는다. 다른 작업자의 worktree와 열린 PR은 보존한다. 병합은 독립 검수 후 별도 출시 담당자가 판단한다.

## 복구와 수용 기준

- [x] 저장소 밖 7개 파일 복사와 binary/full-index patch를 보존했다.
- [x] named stash를 보존하고 현재 master로 ff-only 이동 후 apply-not-pop으로 복원했다.
- [x] 기존 기준과 현재 master 사이의 임대·인접 신원 경로 변경은 0이고, 복원한 후보 7개 SHA256은 이전 체크포인트와 같다.
- [ ] 현재 기준의 정상 pre-commit 전체 검사를 단일 실행으로 통과한다.
- [ ] bundled Node 24의 정상 production build를 단일 실행으로 통과한다.
- [ ] 정확한 8개 경로만 커밋·푸시하고 non-draft PR을 HOLD로 반환한다.
- [ ] 해당 head의 CI·GitGuardian 최종 상태와 독립 검수를 확인한다.

## 검증 기록과 중단 조건

과거 증거: 이전 기준 `d0393171`에서 집중 33/33, 더 오래된 회귀 묶음 71/71이 통과했다. 이전 전체 검사는 stale `.next` 참조 및 범위 밖 시간초과로 실패했고, 이전 빌드는 vendor 단계 exit 1로 끝나 Next build가 실행되지 않았다. 과거 결과는 현재 기준의 전체 검사·빌드 성공을 뜻하지 않는다.

현재 실행: 원본 7개 바이트를 보존한 복구만 완료했다. 이 계획을 추가한 현재 후보의 정상 훅·빌드·PR·CI·독립 검수는 아직 미실행이다. 훅은 process-local Node 24와 Vitest threads/forks 최소·최대 1로 한 번 실행하고, 통과하면 동일 런타임 production build를 한 번 실행한다. 실패·해시 변화·범위 밖 변경·base 충돌 시 즉시 중단하여 Foreman에게 반환하며 재시도나 제품 수정으로 우회하지 않는다.

복구점: `C:\Users\belie\Desktop\Belief\클로드\recovery\salespt-r3-month-todo-identity-r1-20261016-02`; 새 보존 stash `e997e6c9c4dfb399f1a5cdc715133a4a679d6774`. 복구 자료는 독립 검수가 끝날 때까지 유지한다. 제품 커밋의 향후 롤백은 해당 커밋 revert이며 운영 데이터 복구는 이 작업 범위에 없다. 최종 훅·빌드 결과는 후보 바이트를 다시 바꾸지 않고 PR과 전달 패킷에 기록한다.
