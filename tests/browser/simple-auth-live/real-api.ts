/**
 * 라이브 셸 `?real=1` — 실제 SimpleAuthPanel(components/simple-auth)을 가상 /api/simple-auth 응답으로 그려
 * 승인 목업과 나란히 비교한다. 가상 이름·번호만. 서버·CODEF 호출 없음.
 */
import type { SimpleAuthRequest } from "@/types/simple-auth";

const iso = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
const ok = (key: SimpleAuthRequest["docs"][number], facts: string[], fields: { key: string; value: string }[] = []) =>
  ({ key, ok: true, facts, fields: fields.map((f) => ({ ...f, confidence: 0.9 })), issuedAt: "2026-11-09", hasOriginal: true });

const DATA: SimpleAuthRequest[] = [
  { id: "00000000-0000-4000-8000-000000000001", owner: "김가상", phone: "010-0000-5678", method: "카카오톡", docs: ["biz", "vat", "fs"], status: "waiting",
    sentAt: iso(1), deadline: Date.now() + 200_000, resends: 0, progress: 0, businesses: [] },
  { id: "00000000-0000-4000-8000-000000000002", owner: "남가상", phone: "010-0000-1207", method: "네이버", docs: ["biz", "vat", "fs"], status: "done",
    sentAt: iso(90), deadline: 0, resends: 0, progress: 3, businesses: [{
      bizNo: "312-81-55210", name: "주식회사 가상바다수산물유통가공영농조합법인 제2공장", applied: false,
      link: { state: "linked", dbId: "db-1", company: "주식회사 가상바다수산물유통가공영농조합법인 제2공장", why: "bizNo" },
      results: [
        ok("biz", ["개업일 2019-03-11 · 개인사업자", "업태 제조업 · 종목 금속가공"], [{ key: "개업일", value: "19.03.11" }, { key: "업태", value: "제조업" }]),
        ok("vat", ["2025년 1,284,500,000원 · 2024년 1,012,300,000원"], [{ key: "과년도매출", value: "1,284.5" }]),
        { key: "fs", ok: false, reason: "2025년분이 아직 신고되지 않았어요.", facts: [], fields: [], hasOriginal: false },
      ] }] },
  { id: "00000000-0000-4000-8000-000000000003", owner: "박가상", phone: "010-0000-4471", method: "토스", docs: ["biz", "vat"], status: "done",
    sentAt: iso(60 * 26), deadline: 0, resends: 0, progress: 2, businesses: [
      { bizNo: "607-12-33410", name: "가상철강", applied: false, link: { state: "pick", candidates: [{ dbId: "db-2", company: "가상철강(주)", owner: "박가상", phone: "010-0000-4471" }] },
        results: [ok("biz", ["개업일 2015-05-02 · 개인사업자"]), ok("vat", ["2025년 830,000,000원"])] },
      { bizNo: "607-25-81002", name: "가상정밀가공", applied: false, link: { state: "none" },
        results: [ok("biz", ["개업일 2022-01-10 · 개인사업자"]), ok("vat", ["2025년 120,000,000원"])] },
    ] },
  { id: "00000000-0000-4000-8000-000000000004", owner: "이가상", phone: "010-0000-8890", method: "PASS", docs: ["biz"], status: "failed",
    sentAt: iso(60 * 27), deadline: 0, resends: 0, progress: 0, error: "가상 오류 — 고객 정보가 홈택스와 달라요.", businesses: [] },
];

export function installRealApi() {
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (url.startsWith("/api/simple-auth/") && url.includes("/company")) return json({ ci: {}, readOnly: false });
    if (url.startsWith("/api/simple-auth/")) {
      const id = url.split("/")[3]!;
      const body = JSON.parse(String(init?.body ?? "{}")) as { action: string };
      if (body.action === "confirm") return json({ request: DATA.find((r) => r.id === id), message: "고객이 아직 승인하지 않았어요. 승인한 뒤 다시 눌러 주세요." });
      return json({ request: DATA.find((r) => r.id === id) });
    }
    if (url === "/api/simple-auth" && init?.method === "POST") return json({ error: "목업에서는 보내지 않아요." }, 503);
    if (url === "/api/simple-auth") return json({ requests: DATA });
    return real(input, init);
  };
}
