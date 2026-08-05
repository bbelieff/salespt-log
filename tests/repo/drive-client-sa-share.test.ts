/**
 * BBE-45 회귀 — 새로 복제한 수강생 시트가 **SA 에 명시 공유**되는지.
 *
 * 사고 배경(실측 2026-08-06): 10기 시트 6개가 SA 명시공유 X · 폴더상속 X 로
 * **링크공유(anyone-with-link writer)에만 의존**하는 상태였다. 링크공유를 잠그면 앱이 끊긴다.
 * 9기는 명시공유 O 라 안전 — 즉 기수마다 결과가 갈리는 우연한 상태였다.
 *
 * 왜 `copyTemplateSheet` 안에서 검증하나: 복제 호출부가 **3곳**(일반 기수 라우트·아레나
 * 라우트·pending 재시도 서비스)이라 서비스 한 곳만 고치면 주 경로가 새는 것을 이 테스트가 고정한다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface PermArg {
  fileId: string;
  supportsAllDrives: boolean;
  sendNotificationEmail: boolean;
  requestBody: { type: string; role: string; emailAddress: string };
}

const copy = vi.fn(async () => ({ data: { id: "new-sheet-id" } as { id?: string } }));
const permissionsCreate = vi.fn(async (_arg: PermArg) => ({ data: {} }));

vi.mock("googleapis", () => ({
  google: {
    drive: () => ({ files: { copy }, permissions: { create: permissionsCreate } }),
    auth: {
      JWT: class {},
      OAuth2: class {
        setCredentials() {}
      },
    },
  },
}));

vi.mock("@/config", () => ({
  serviceAccount: () => ({ client_email: "sa@project.iam.gserviceaccount.com", private_key: "k" }),
  authConfig: () => ({ googleId: "id", googleSecret: "secret" }),
  adminDriveRefreshToken: () => "refresh-token",
}));

import { copyTemplateSheet } from "@/repo/drive-client";

beforeEach(() => {
  copy.mockClear();
  permissionsCreate.mockClear();
  permissionsCreate.mockImplementation(async () => ({ data: {} }));
});

describe("copyTemplateSheet — SA 공유 동반 (BBE-45)", () => {
  it("복제 성공 시 SA 를 writer 로 공유한다", async () => {
    const id = await copyTemplateSheet("template-id", "제목", "folder-id");

    expect(id).toBe("new-sheet-id");
    expect(permissionsCreate).toHaveBeenCalledTimes(1);
    const arg = permissionsCreate.mock.calls[0]![0];
    expect(arg.fileId).toBe("new-sheet-id");
    expect(arg.requestBody).toEqual({
      type: "user",
      role: "writer",
      emailAddress: "sa@project.iam.gserviceaccount.com",
    });
    // 수강생에게 공유 알림 메일이 가면 안 된다(운영 노이즈).
    expect(arg.sendNotificationEmail).toBe(false);
  });

  it("★공유 실패해도 복제 결과를 그대로 반환한다 — 복제 성공을 실패로 뒤집지 않는다", async () => {
    permissionsCreate.mockImplementation(async () => {
      throw new Error("The caller does not have permission");
    });

    // throw 하면 호출부가 시트를 만들어 놓고 실패 처리 → pending 재시도가 중복 복제(#546 멱등 훼손).
    await expect(copyTemplateSheet("template-id", "제목", "folder-id")).resolves.toBe("new-sheet-id");
  });

  it("이미 공유돼 있으면(already exists) 조용히 통과한다 — 재시도 멱등", async () => {
    permissionsCreate.mockImplementation(async () => {
      throw new Error("Permission already exists for this user");
    });

    await expect(copyTemplateSheet("template-id", "제목", "folder-id")).resolves.toBe("new-sheet-id");
  });

  it("복제 자체가 id 를 안 주면 던진다 — 공유 단계로 넘어가지 않는다", async () => {
    copy.mockImplementationOnce(async () => ({ data: {} }));

    await expect(copyTemplateSheet("template-id", "제목", "folder-id")).rejects.toThrow("복제 결과 id 없음");
    expect(permissionsCreate).not.toHaveBeenCalled();
  });
});
