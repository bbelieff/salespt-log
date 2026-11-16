/**
 * Layer: service — 오류 신고함 조회(admin-phase1, 2026-11-16). 읽기만 한다.
 * 볼 수 있는 사람 = 마스터(ADMIN_EMAILS) + 관리부서(활성 트레이너 행, 부서 "관리").
 * 신고 내용은 어디에도 로그로 남기지 않는다.
 */
import { z } from "zod";
import { adminEmails } from "@/config";
import { findTrainerByEmail } from "@/repo/users";
import { dbEnabled } from "@/repo/db/client";
import { countBugReports, countNewBugReports, getBugReportImage, listBugReports } from "@/repo/db/bug-reports";
import { BugReportContext } from "@/types/bug-report";

export const BUG_REPORT_PAGE_SIZE = 20;
/** 「새 신고」로 세는 기간(일) — 상태를 바꾸는 기능이 아직 없어 오래된 건은 세지 않는다. */
export const BUG_REPORT_NEW_DAYS = 7;

export class BugReportForbidden extends Error {}

export interface BugReportListItem {
  id: string;
  createdAt: string;
  email: string;
  name: string;
  cohort: string;
  category: string;
  body: string;
  hasImage: boolean;
  status: string;
  /** 보던 화면 — 제목과 주소. */
  pageTitle: string;
  pagePath: string;
  /** 그때 화면에 났던 오류 메시지(최대 10개). */
  errors: string[];
}
export interface BugReportPage {
  /** DB 가 꺼져 있으면 false(로컬 등) — 목록은 빈 채로. */
  enabled: boolean;
  rows: BugReportListItem[];
  total: number;
  page: number;
  pageCount: number;
}

async function assertCanRead(viewerEmail: string | null | undefined): Promise<void> {
  const email = (viewerEmail ?? "").trim().toLowerCase();
  if (!email) throw new BugReportForbidden("forbidden");
  if (adminEmails().includes(email)) return;
  const t = await findTrainerByEmail(email);
  if (t && t.role === "trainer" && t.status === "active" && t.cohort.trim() === "관리") return;
  throw new BugReportForbidden("forbidden");
}

export async function listBugReportsForAdmin(viewerEmail: string | null | undefined, page = 1): Promise<BugReportPage> {
  await assertCanRead(viewerEmail);
  if (!dbEnabled()) return { enabled: false, rows: [], total: 0, page: 1, pageCount: 1 };
  const total = await countBugReports();
  const pageCount = Math.max(1, Math.ceil(total / BUG_REPORT_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1), pageCount);
  const raw = await listBugReports(BUG_REPORT_PAGE_SIZE, (safePage - 1) * BUG_REPORT_PAGE_SIZE);
  const rows = raw.map((r) => {
    const ctx = BugReportContext.safeParse(r.context ?? {});
    const c = ctx.success ? ctx.data : BugReportContext.parse({});
    return {
      id: r.id, createdAt: r.createdAt, email: r.email, name: r.name, cohort: r.cohort,
      category: r.category, body: r.body, hasImage: r.hasImage, status: r.status,
      pageTitle: c.title, pagePath: c.path, errors: c.errors,
    };
  });
  return { enabled: true, rows, total, page: safePage, pageCount };
}

const IMAGE_DATA_URL = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/;

/** 한 건의 캡처(data URL). 없거나 형식이 다르면 null. */
export async function getBugReportImageForAdmin(viewerEmail: string | null | undefined, id: string): Promise<string | null> {
  await assertCanRead(viewerEmail);
  if (!dbEnabled() || !z.string().uuid().safeParse(id).success) return null;
  const image = await getBugReportImage(id);
  return image && IMAGE_DATA_URL.test(image) ? image : null;
}

/** 최근 7일 안의 새 신고 수 — DB 가 꺼져 있으면 0. 권한 확인은 부르는 쪽(관리자 홈)이 한다. */
export async function countNewBugReportsForTodo(): Promise<number> {
  if (!dbEnabled()) return 0;
  return countNewBugReports(BUG_REPORT_NEW_DAYS);
}
