/**
 * ChannelBadge — 4채널 배지 (4종 고정).
 * 정본: docs/design/components.md §4 Badges, docs/design/tokens.md
 */
import type { Channel } from "@/types";

const CLASS_MAP: Record<Channel, string> = {
  매입DB: "badge badge-purchase",
  직접생산: "badge badge-direct",
  현수막: "badge badge-banner",
  "콜·지·기·소": "badge badge-referral",
};

export default function ChannelBadge({ channel }: { channel: Channel }) {
  return <span className={CLASS_MAP[channel]}>{channel}</span>;
}
