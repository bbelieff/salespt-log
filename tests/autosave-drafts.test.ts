/**
 * Scope D — 팝업관리 초안 자동보관 가드 (notice/updates, 발행 의도 분리).
 *
 * - 범위 키잉: 키에 인증 admin 이메일 포함, 무범위 키 생성 금지 (localStorage 미사용).
 * - 복원: 저장→읽기 라운드트립, 타 admin 격리.
 * - ACK 정합: 저장 중 이어쓰기·늦은 응답이 초안을 지우지 않음.
 * - 렌더 무전송: 마운트·복원·타이머 경로에 fetch 없음 (소스 정적 가드).
 * - 실패 보존: 저장소 예외가 throw·거짓 성공이 되지 않음.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearDraft,
  clearDraftOnAck,
  draftKey,
  fingerprint,
  loadDraft,
  normalizeScope,
  saveDraft,
  shouldClearOnAck,
  type DraftStore,
} from "@/app/admin/popup/_components/useScopedDraft";

function memStore(initial: Record<string, string> = {}): DraftStore & {
  _map: Map<string, string>;
} {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    _map: m,
  };
}

function throwingStore(): DraftStore {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
}

const root = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const NOTICE_SRC = () => root("app/admin/popup/_components/NoticeManager.tsx");
const UPDATES_SRC = () => root("app/admin/popup/_components/UpdatesManager.tsx");
const HOOK_SRC = () => root("app/admin/popup/_components/useScopedDraft.ts");

/** useEffect( 콜백 본문들을 brace matching 으로 추출 — fetch 유무 검사 dwell. */
function effectBodies(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (true) {
    const at = src.indexOf("useEffect(", i);
    if (at < 0) break;
    const open = src.indexOf("{", at);
    if (open < 0) break;
    let depth = 0;
    let j = open;
    for (; j < src.length; j += 1) {
      if (src[j] === "{") depth += 1;
      else if (src[j] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push(src.slice(open, j + 1));
    i = j + 1;
  }
  return out;
}

describe("scoped draft key", () => {
  it("이메일 정규화해 키잉한다", () => {
    expect(draftKey("Admin@Example.com ", "notice:1")).toBe(
      "popup-draft:v1:admin@example.com:notice:1",
    );
    expect(normalizeScope("  A@B.c ")).toBe("a@b.c");
  });

  it("scope·slot 없으면 키를 만들지 않는다 (무범위 저장 금지)", () => {
    expect(draftKey("", "notice:1")).toBeNull();
    expect(draftKey(null, "notice:1")).toBeNull();
    expect(draftKey("a@b.c", "")).toBeNull();
    expect(draftKey("a@b.c", null)).toBeNull();
  });

  it("sessionStorage 만 쓰고 unscoped localStorage 를 쓰지 않는다", () => {
    for (const src of [HOOK_SRC(), NOTICE_SRC(), UPDATES_SRC()]) {
      expect(src).not.toMatch(/localStorage/);
    }
    expect(HOOK_SRC()).toMatch(/sessionStorage/);
  });
});

describe("draft storage/restore", () => {
  it("저장→복원 라운드트립 + base·rev 보존", () => {
    const s = memStore();
    const r = saveDraft(s, "a@b.c", "notice:1", { title: "t" }, "base-1");
    expect(r.ok).toBe(true);
    const d = loadDraft<{ title: string }>(s, "a@b.c", "notice:1");
    expect(d?.value).toEqual({ title: "t" });
    expect(d?.base).toBe("base-1");
    expect(d?.rev).toBe(r.rev);
  });

  it("다른 admin scope 에는 노출하지 않는다", () => {
    const s = memStore();
    saveDraft(s, "a@b.c", "notice:1", { title: "secret" }, "b");
    expect(loadDraft(s, "evil@b.c", "notice:1")).toBeNull();
    expect(loadDraft(s, "", "notice:1")).toBeNull();
  });

  it("깨진 봉투·없는 키는 null (throw 없음)", () => {
    const s = memStore({ "popup-draft:v1:a@b.c:notice:1": "not-json{{{" });
    expect(loadDraft(s, "a@b.c", "notice:1")).toBeNull();
    expect(loadDraft(memStore(), "a@b.c", "notice:1")).toBeNull();
  });
});

describe("save ACK shouldn't discard later editing", () => {
  it("stored==acked==current 일 때만 정리", () => {
    expect(shouldClearOnAck("r1", "r1", "r1")).toBe(true);
    // 저장 중 이어쓰기 — 현재가 ACK 와 다르면 유지
    expect(shouldClearOnAck("r1", "r1", "r2")).toBe(false);
    // 늦은/뒤바뀐 응답 — 보관 rev 가 ACK 와 다르면 유지
    expect(shouldClearOnAck("r2", "r1", "r1")).toBe(false);
    expect(shouldClearOnAck(null, "r1", "r1")).toBe(true);
    expect(shouldClearOnAck("r1", "", "r1")).toBe(false);
  });

  it("이어쓴 초안은 clearDraftOnAck 가 지우지 않고, 일치분은 지운다", () => {
    const s = memStore();
    const v1 = { title: "v1" };
    const saved = saveDraft(s, "a@b.c", "notice:1", v1, "b");
    // 이어쓰기: 현재 rev != ACK rev → false, 보관 유지
    expect(clearDraftOnAck(s, "a@b.c", "notice:1", saved.rev, fingerprint({ title: "v2" }))).toBe(
      false,
    );
    expect(loadDraft(s, "a@b.c", "notice:1")?.value).toEqual(v1);
    // 일치: 정리됨
    expect(clearDraftOnAck(s, "a@b.c", "notice:1", saved.rev, saved.rev)).toBe(true);
    expect(loadDraft(s, "a@b.c", "notice:1")).toBeNull();
  });

  it("fingerprint 는 값 변화를 구분한다", () => {
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
    expect(fingerprint({ a: 1 })).toBe(fingerprint({ a: 1 }));
  });
});

describe("failure preservation", () => {
  it("저장소 차단이면 ok:false·null, throw 없음 — 성공처럼 표시 불가", () => {
    const bad = throwingStore();
    expect(saveDraft(bad, "a@b.c", "notice:1", { t: 1 }, "b").ok).toBe(false);
    expect(loadDraft(bad, "a@b.c", "notice:1")).toBeNull();
    expect(clearDraftOnAck(bad, "a@b.c", "notice:1", "r", "r")).toBe(false);
    expect(() => clearDraft(bad, "a@b.c", "notice:1")).not.toThrow();
  });

  it("scope 없으면 저장 실패로 보고한다", () => {
    const s = memStore();
    expect(saveDraft(s, "", "notice:1", { t: 1 }, "b").ok).toBe(false);
    expect(s._map.size).toBe(0);
  });
});

describe("no on-render fetch writes", () => {
  it("두 매니저의 useEffect 본문에 fetch 가 없다 (게시 버튼 핸들러에서만 전송)", () => {
    for (const src of [NOTICE_SRC(), UPDATES_SRC()]) {
      expect(src).toMatch(/fetch\(/); // 게시 경로는 존재
      for (const body of effectBodies(src)) {
        expect(body).not.toMatch(/fetch\(/);
      }
    }
  });

  it("hydrate 경로에 POST/PATCH 가 없다", () => {
    for (const src of [NOTICE_SRC(), UPDATES_SRC()]) {
      for (const body of effectBodies(src)) {
        expect(body).not.toMatch(/method:\s*"(POST|PATCH)"/);
      }
    }
  });
});

describe("publish UX wording", () => {
  it("일반 저장 문구 대신 게시 의미 + truthful 초안 상태를 노출한다", () => {
    expect(NOTICE_SRC()).toMatch(/게시 반영/);
    expect(NOTICE_SRC()).toMatch(/초안 보관됨/);
    expect(NOTICE_SRC()).not.toMatch(/h-11 w-full/); // 거대 푸터 게시 버튼 제거
    expect(UPDATES_SRC()).toMatch(/게시 반영 \(/);
    expect(UPDATES_SRC()).toMatch(/초안 .*건 보관됨/);
  });
});
