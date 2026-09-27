import { describe, expect, it } from "vitest";
import { extractDriveFolderId } from "@/util/drive-folder-id";

describe("extractDriveFolderId", () => {
  it("공유 링크 주소에서 ID 만 뽑는다 (12기 생성 사고 입력 그대로)", () => {
    expect(
      extractDriveFolderId("https://drive.google.com/drive/folders/1rdV7VVj_OFdZvNaa_iaXqMIjayvFWgUC?usp=drive_link"),
    ).toBe("1rdV7VVj_OFdZvNaa_iaXqMIjayvFWgUC");
  });
  it("u/0 경로·끝 슬래시도 처리한다", () => {
    expect(extractDriveFolderId("https://drive.google.com/drive/u/0/folders/abc_DEF-123/")).toBe("abc_DEF-123");
  });
  it("open?id= 형식", () => {
    expect(extractDriveFolderId("https://drive.google.com/open?id=abc_DEF-123")).toBe("abc_DEF-123");
  });
  it("ID 만 넣으면 그대로, 앞뒤 공백 제거", () => {
    expect(extractDriveFolderId("  1rdV7VVj_OFdZvNaa_iaXqMIjayvFWgUC ")).toBe("1rdV7VVj_OFdZvNaa_iaXqMIjayvFWgUC");
  });
  it("빈 값은 빈 값", () => {
    expect(extractDriveFolderId("")).toBe("");
  });
});
