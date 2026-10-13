/**
 * C(#7 채널별 남은 돈) 목업 시나리오 쿠키 — dashboard-followups-fixture.tsx 가 import 만 한다(부수효과).
 * 대시보드로 들어올 때 주소를 읽어 쿠키를 적는다: channel_profit(데이터 묶음 또는 off)·
 * channel_profit_flags(점으로 이은 플래그)·channel_profit_load(쪽 열기마다 새 값 — 「첫 응답만 옛 것」 흉내용).
 * 다른 화면(/payment 등)으로 옮겨 가도 쿠키는 그대로라 같은 합성 계약이 보인다.
 * 값의 뜻은 dashboard-channel-profit-data.mjs 머리말.
 */
const DATASETS = ["demo", "empty", "loss", "large"] as const;
const FLAGS = ["ledgerFail", "noChannels", "staleChannels", "renamed", "stuck"] as const;

function syncChannelProfitCookie(): void {
  if (location.pathname !== "/" && location.pathname !== "/dashboard") return;
  const params = new URLSearchParams(location.search);
  const flags = FLAGS.filter((f) => params.get(f) === "1");
  const asked = params.get("channels");
  const dataset = DATASETS.find((d) => d === asked) ?? (asked !== null || flags.length > 0 ? "demo" : "off");
  document.cookie = `channel_profit=${dataset}; path=/`;
  document.cookie = `channel_profit_flags=${flags.join(".")}; path=/`;
  document.cookie = `channel_profit_load=${Date.now().toString(36)}; path=/`;
}

syncChannelProfitCookie();
