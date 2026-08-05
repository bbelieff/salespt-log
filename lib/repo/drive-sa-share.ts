/**
 * Layer: repo — Drive 파일을 SA 에 명시 편집자로 공유 (BBE-45, 2026-08-06).
 *
 * `drive-client.ts` 에서 분리한 이유는 둘: ①500줄 캡 ②배치 위치 함정 회피.
 * `layers.test.ts` 의 ADR-0015 가드가 `driveCreatorClient` 선언부터 다음 `export` 까지를
 * 잘라 `serviceAccount(` 사용을 금지한다(2026-06-11 SA silent 폴백 quota 사고). 같은 파일
 * 안에서 그 구간에 들어가면 폴백이 아닌데도 가드가 걸린다 — 별도 파일이면 원천적으로 안 걸린다.
 * 여기서 SA 는 **권한을 줄 대상(이메일)** 일 뿐, 파일 생성 자격은 그대로 admin OAuth 다.
 *
 * 왜 필요한가: 앱은 수강생 시트를 SA 로 읽고 쓴다(`sheets-client.ts`). SA 접근 경로는
 * ①명시 공유 ②부모 폴더 상속 둘뿐인데, 2026-05-12 `fe4a0b8` 이 "폴더 한 번 공유하면
 * 상속되므로 자동화 불필요"라는 근거로 SA 자동 공유(`704ac5c`)를 걷어냈다. 그 전제는
 * **폴더가 실제로 공유돼 있을 때만** 성립한다 — 10기는 성립하지 않아(폴더 미공유) 시트
 * 6개가 **링크공유(anyone-with-link writer)에만 의존**하는 상태가 됐다. 링크공유를 잠그는
 * 순간 앱 접근이 끊긴다. 실측: `scripts/ops/verify-sa-sheet-access.mjs --cohort 9,10`.
 */
import type { drive_v3 } from "googleapis";
import { serviceAccount } from "@/config";

/**
 * 실패해도 **throw 하지 않는다** — 복제 자체는 이미 성공했고, 여기서 던지면 호출부가
 * 시트를 만들어 놓고 실패로 처리해 pending 재시도가 중복 복제를 시도한다(#546 멱등 전제 훼손).
 * 링크공유가 살아 있는 한 앱은 계속 동작하므로 경고만 남기고 감사 스크립트로 잡는다.
 *
 * @param client 호출부가 이미 만든 `driveCreatorClient()` 인스턴스를 그대로 넘긴다 —
 *   여기서 새로 만들지 않는다(캐시된 admin OAuth 클라이언트 재사용, 이중 인증 방지).
 */
export async function shareWithServiceAccount(client: drive_v3.Drive, fileId: string): Promise<void> {
  const saEmail = serviceAccount().client_email;
  try {
    await client.permissions.create({
      fileId,
      supportsAllDrives: true,
      sendNotificationEmail: false,
      requestBody: { type: "user", role: "writer", emailAddress: saEmail },
    });
    console.warn("[cohort-create] SA 공유 추가 " + JSON.stringify({ fileId }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/already|duplicate/i.test(msg)) return; // 이미 있으면 정상(멱등)
    console.warn(
      "[cohort-create] SA 공유 실패(복제는 성공 — 링크공유로 동작 중) " +
        JSON.stringify({ fileId, msg }),
    );
  }
}
