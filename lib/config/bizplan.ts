/**
 * 사업계획서 작성도구 설정(docs/plans/active/bizplan-tool.md, ADR-0039).
 *
 * 공식 빌더·양식은 저장소에 넣지 않는다 — 이 저장소는 공개라 대표님 빌더가 그대로 드러난다.
 * 대신 관리자 구글 드라이브의 비공개 폴더에 두고 서버가 관리자 OAuth(driveCreatorClient)로 읽는다.
 * 폴더 ID 는 비밀이 아니다(권한 없는 사람은 열 수 없음) → env 오버라이드 + 기본값(공지 이미지 폴더와 같은 방식).
 * 새 공식 판을 내려면 대표님이 이 폴더에 새 md 를 올리기만 하면 된다(이름의 v 번호가 가장 큰 것이 최신).
 */
export const bizplanKitFolderId = (): string =>
  (process.env.BIZPLAN_KIT_FOLDER_ID ?? "").trim() || "1u_-CiDmLzwwRnfdr5_7rphQd7Z2qYQ2C";

/** 꾸러미로 내려보내는 공식 파일 하나의 상한 — 지금 가장 큰 현장클리닉 양식이 약 3.4MB. */
export const BIZPLAN_KIT_FILE_MAX_BYTES = 20 * 1024 * 1024;

/** 공식 파일 종류 — 주소 `/api/bizplan/kit/<kind>` 에 쓴다. */
export const BIZPLAN_KIT_KINDS = ["builder", "clinic", "interview"] as const;
export type BizplanKitKind = (typeof BIZPLAN_KIT_KINDS)[number];
