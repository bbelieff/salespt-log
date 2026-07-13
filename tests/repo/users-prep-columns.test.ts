/**
 * prep row 열밀림·중복 가드 (fix/prep-append-column-shift 2026-07-13).
 *
 * 배경: addTraineePrepRow 가 values.append(테이블 자동감지)로 써서, 빈 A열 prep 행이 있으면
 * 새 행이 J열~로 8칸 밀려 적재됨(A~I 빈, J=cohort…). 밀린 행은 B(cohort)가 비어 dedup
 * 매칭이 실패 → 같은 입력 재제출마다 새 밀린 행이 쌓임(연습용2 3행·김현민 5행 사고).
 * 수정: 고정폭(A~Q) 배열 + 결정적 A{n} update. 이 순수 헬퍼 2개를 박제.
 */
import { describe, it, expect } from "vitest";
import { buildPrepRowValues, findPrepRowIndex } from "@/repo/users-prep";

const CACHED = {
  cohortLabel: "8",
  nameLabel: "김현민",
  courseStartISO: "2026-06-12",
  graduationISO: "2026-08-01",
};

describe("buildPrepRowValues (고정폭 A~Q, 열밀림 방지)", () => {
  it("항상 A열(email='')부터 정렬 — 열 위치 고정", () => {
    const v = buildPrepRowValues({
      cohort: "8기",
      name: " 김현민 ",
      spreadsheetId: "SHEET_ID",
      assignedTrainer: "베스트",
      feedbackFolderId: "FFID",
      memo: "입금",
      cached: CACHED,
    });
    expect(v).toHaveLength(17); // A~Q
    expect(v[0]).toBe(""); //            A email (self-claim 시 채움)
    expect(v[1]).toBe("8"); //           B cohort — "기" 정규화
    expect(v[2]).toBe("김현민"); //       C name — trim
    expect(v[3]).toBe("SHEET_ID"); //    D spreadsheetId
    expect(v[4]).toBe("trainee"); //     E role
    expect(v[5]).toBe("active"); //      F status
    expect(v[6]).toBe("베스트"); //       G assignedTrainer
    expect(v[7]).toBe(""); //            H team
    expect(v[8]).toBe("8"); //           I cohortLabel
    expect(v[9]).toBe("김현민"); //       J nameLabel
    expect(v[10]).toBe("2026-06-12"); // K courseStartISO
    expect(v[11]).toBe("2026-08-01"); // L graduationISO
    expect(v[12]).toBe("0"); //          M sortOrder
    expect(v[13]).toBe(""); //           N drive_parent_path
    expect(v[14]).toBe("FFID"); //       O feedback_folder_id
    expect(v[15]).toBe(""); //           P drive_link_status
    expect(v[16]).toBe("입금"); //        Q memo
  });

  it("memo·folder 없으면 N~Q 는 빈 문자열(폭은 그대로 17)", () => {
    const v = buildPrepRowValues({
      cohort: "9",
      name: "오이슬",
      spreadsheetId: "SID2",
      cached: { cohortLabel: "", nameLabel: "", courseStartISO: "", graduationISO: "" },
    });
    expect(v).toHaveLength(17);
    expect(v[14]).toBe(""); // O
    expect(v[16]).toBe(""); // Q
    expect(v[1]).toBe("9");
    expect(v[2]).toBe("오이슬");
  });
});

describe("findPrepRowIndex (dedup — 중복 append 방지)", () => {
  // 정상 정렬 행: A=email, B=cohort, C=name, ...
  const aligned = [
    ["a@x.com", "8", "김현민", "SID", "trainee", "active"],
    ["", "9", "오이슬", "SID2", "trainee", "active"],
  ];

  it("(cohort,name) 일치 행 인덱스 반환 — '기' 정규화", () => {
    expect(findPrepRowIndex(aligned, "8", "김현민")).toBe(0);
    expect(findPrepRowIndex(aligned, "8기", "김현민")).toBe(0); // 입력 기수에 기 붙어도
    expect(findPrepRowIndex(aligned, "9", "오이슬")).toBe(1);
  });

  it("없으면 -1", () => {
    expect(findPrepRowIndex(aligned, "8", "없는사람")).toBe(-1);
    expect(findPrepRowIndex(aligned, "7", "김현민")).toBe(-1);
    expect(findPrepRowIndex([], "8", "김현민")).toBe(-1);
  });

  it("★열밀림 행(A~I 빈, J=cohort)은 B가 비어 매칭 안 됨 = 버그 재현 방지 회귀", () => {
    // 밀린 행: 데이터가 index 8(I)부터 — B(index1)는 빈 문자열.
    const shifted = [
      ["", "", "", "", "", "", "", "", "", "8", "김현민", "SID"], // J=cohort, K=name
    ];
    // 밀린 행은 매칭 실패(-1) → addTraineePrepRow 는 이 경우 신규 A{n} write 를 하지만
    // 그 write 자체가 A열 정렬이므로 더는 밀리지 않는다(중복 누적이 여기서 끊긴다).
    expect(findPrepRowIndex(shifted, "8", "김현민")).toBe(-1);
  });
});
