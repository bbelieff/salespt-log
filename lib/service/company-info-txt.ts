/**
 * Layer: service — 업체정보 TXT 추출 유스케이스 (consultation-log §3-3, ADR-0016).
 *
 * 대상 폴더 = registry O(feedback_folder_id): 아레나 = 업체관리 폴더(생성 시 stamp),
 * 일반 기수 = 피드백업체 폴더(Drive 연동 시 stamp). 빈값이면 명확한 에러.
 * 파일 = `업체정보_{업체명}.txt` 업체당 1본 덮어쓰기.
 */
import { findUserByEmail } from "@/repo/users";
import { upsertTxtInFolder } from "@/repo/drive-txt";
import type { CompanyInfo } from "@/types";

// 키 → 표시 라벨 (CompanyInfoEditor 와 동일 표기). [업체] 12 + [대표자] 8.
const 업체_LABELS: [keyof CompanyInfo, string][] = [
  ["개업일", "개업일"],
  ["사업자구분", "사업자구분"],
  ["사업자등록번호", "사업자등록번호"],
  ["소재지", "소재지"],
  ["소유여부", "소유여부"],
  ["업종주생산품목", "업종/주생산품목"],
  ["과년도매출", "과년도 매출"],
  ["금년도매출", "금년도 매출"],
  ["기대출사업자", "기대출(사업자)"],
  ["사대보험직원", "4대보험 직원"],
  ["특허및인증", "특허/인증"],
  ["업체기타메모", "기타 메모"],
];
const 대표자_LABELS: [keyof CompanyInfo, string][] = [
  ["대표자이름", "대표자 이름"],
  ["연락처통신사", "연락처/통신사"],
  ["신용점수", "신용점수"],
  ["기대출개인", "기대출(개인)"],
  ["자택주소지", "자택 주소지"],
  ["대표소유여부", "소유여부"],
  ["동종업계경력", "동종업계 경력"],
  ["대표기타메모", "기타 메모"],
];

/** 사람이 읽는 TXT 본문 — [업체]/[대표자] 라벨:값 줄 + 추출시각. 순수(테스트 대상). */
export function formatCompanyInfoTxt(
  업체명: string,
  ci: CompanyInfo,
  extractedAtISO: string,
): string {
  const line = ([k, label]: [keyof CompanyInfo, string]) =>
    `${label}: ${String(ci[k] ?? "") || "-"}`;
  const customLines = (g: "업체" | "대표자") =>
    Object.entries(ci.커스텀?.[g] ?? {}).map(([k, v]) => `${k}: ${v || "-"}`);
  return [
    `■ 업체정보 — ${업체명}`,
    "",
    "[업체]",
    ...업체_LABELS.map(line),
    ...customLines("업체"),
    "",
    "[대표자]",
    ...대표자_LABELS.map(line),
    ...customLines("대표자"),
    "",
    `(추출시각: ${extractedAtISO})`,
  ].join("\n");
}

/** TXT 파일명 — 업체당 1본 키. */
export function companyInfoTxtFileName(업체명: string): string {
  return `업체정보_${업체명.trim()}.txt`;
}

/** 추출 실행 — 사용자 O 폴더에 1본 덮어쓰기. 반환 = 링크 + 갱신 여부. */
export async function exportCompanyInfoTxt(
  email: string,
  data: { 업체명: string; 업체정보: CompanyInfo },
): Promise<{ webViewLink: string; updated: boolean }> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[company-info-txt] 등록되지 않은 사용자: ${email}`);
  const folderId = (user.feedbackFolderId ?? "").trim();
  if (!folderId) {
    throw new Error(
      "업체관리(피드백업체) 폴더가 연결되어 있지 않습니다 — Drive 연동 후 사용하세요.",
    );
  }
  const content = formatCompanyInfoTxt(
    data.업체명,
    data.업체정보,
    new Date().toISOString(),
  );
  const r = await upsertTxtInFolder(
    folderId,
    companyInfoTxtFileName(data.업체명),
    content,
  );
  return { webViewLink: r.webViewLink, updated: r.updated };
}
