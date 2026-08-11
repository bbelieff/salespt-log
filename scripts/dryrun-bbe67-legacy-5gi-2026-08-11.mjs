/**
 * BBE-67 — 5기 legacy 어댑터 dry-run(DB write 0). 2026-08-11.
 *
 * `scripts/ops/backfill-sheet-rows.mjs` 의 실제 `extractUserRows()` 를 registry 를 거치지
 * 않고 **직접 호출**한다. 이유: registry 5기 linkage 가 아직 0/8(G작업원D 소유, 별도 미실행
 * 작업)이라 `--cohort 5`/`--sheet <id>` 둘 다 CLI 의 registry-driven 경로로는 대상을 못 찾는다
 * (실측 확인 — 위 두 방식 전부 registry `users` 시트에서 spreadsheetId 매칭 0건). 그래서
 * 이 dry-run 은 registry 를 우회해 5기 8개 spreadsheetId 를 **직접 대상으로** extractUserRows
 * 를 호출한다 — DB Pool/upsert 코드는 아예 실행되지 않으므로(그 코드는 CLI 의 main() 안에만
 * 있음, 이 스크립트는 main() 을 호출하지 않는다) DB write 는 물리적으로 0이다.
 *
 * G작업원D 예측(manifest bbe67-5g-v2/v3, Linear `0a1900e5`) 대비 실측치를 대조한다:
 *   source 8/8 · sales 515 · contracts 37 · db 38 · total 590 · read error 0
 */
import { extractUserRows, getLegacySalesChannelStats } from "./ops/backfill-sheet-rows.mjs";

// G작업원D manifest(Linear f1eca427) 정본 8개 — 익명 라벨만 로그에 남긴다.
const SOURCES = [
  { label: "source-1", sid: "16F4pKPuNkkgwhFeU8CrWa6dVU_rbJ-T3LKc2Hk208n4", predicted: 74 },
  { label: "source-2", sid: "1q33IhL1Uq47Oqr7uRmZ7NgSzgk1XdgDJZMtd5nTGMuk", predicted: 86 },
  { label: "source-3", sid: "1Sod7B0jIVR1PmeVX7OMZz3nJhvPFpLNdXQwLO32bjfY", predicted: 66 },
  { label: "source-4", sid: "1aBF4OcDsOTA1VWhAy50LmIFuMLlTmaA0BiJYy5QpS44", predicted: 84 },
  { label: "source-5", sid: "1ss9ZzzojlM7mH2SE7uh4aRrTXph9h4J7X3r02JpD19o", predicted: 61 },
  { label: "source-6", sid: "1vgKxxo2b_OC-9xSjh3lMEBNuaIiTrsauhhBWPIq2s30", predicted: 84 },
  { label: "source-7", sid: "1C0H9fwwLpD8LxqndBeU6BW-TMaVZXybOJ_WtnzzaO0U", predicted: 83 },
  { label: "source-8", sid: "1uoGeVON2DOimCp9R_C2Vmr05ObZMn2gCfX31VeAHuGE", predicted: 52 },
];

async function main() {
  console.log("=== BBE-67 5기 legacy 어댑터 dry-run(DB write 0) ===\n");
  const TABS = ["meetings", "contracts", "todos", "sales", "db", "company_archive"];
  const totals = Object.fromEntries(TABS.map((t) => [t, 0]));
  let sourcesOk = 0;

  for (const src of SOURCES) {
    try {
      const rows = await extractUserRows(src.sid);
      const line = TABS.map((t) => `${t}:${rows[t].length}`).join(" ");
      const total = rows.sales.length + rows.contracts.length + rows.db.length;
      console.log(`${src.label} (예측 ${src.predicted}) → ${line} (sales+contracts+db=${total})`);
      for (const t of TABS) totals[t] += rows[t].length;
      sourcesOk++;
    } catch (e) {
      console.error(`${src.label} 읽기 실패:`, e instanceof Error ? e.message : e);
    }
  }

  const grandTotal = totals.sales + totals.contracts + totals.db;
  console.log("\n── 결과 표 ──");
  for (const t of TABS) console.log(`${t} | ${totals[t]}`);
  console.log(`\nsource ${sourcesOk}/8 · sales ${totals.sales} · contracts ${totals.contracts} · db ${totals.db} · total(sales+contracts+db) ${grandTotal}`);
  console.log("G작업원D 예측(aggregate-only, grid 미검증): source 8/8 · sales 515 · contracts 37 · db 38 · total 590");

  const chStats = getLegacySalesChannelStats();
  console.log(
    `\nsales 채널 포지션 전수검증(반장 §4-A): ${chStats.checked}건 확인 · 불일치 ${chStats.mismatch}건` +
      (chStats.mismatch > 0 ? " ⚠️" : " ✅"),
  );
  console.log("\nDRY-RUN 완료 — DB write 0 (extractUserRows 만 호출, main()/Pool 미실행).");
}

main().catch((e) => {
  console.error("dry-run 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
