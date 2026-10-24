/** 배지 메달 — 3D 그림 + 금속 테 + 리본. 잠긴 배지는 회색, 숨은 배지는 「?」. */
import type { BadgeTier } from "@/lib/analytics/badge-catalog";
import "./badge-medal.css";

export default function BadgeMedal({ img, tier, locked, hidden = false, size }: {
  img: string;
  tier: BadgeTier;
  locked: boolean;
  /** 아직 못 얻은 숨은 배지 — 그림 대신 「?」. */
  hidden?: boolean;
  size?: "sm" | "lg";
}) {
  const cls = ["badge-medal", tier ? `badge-medal--${tier}` : "", locked ? "badge-medal--locked" : "", size ? `badge-medal--${size}` : ""].filter(Boolean).join(" ");
  return (
    <span className={cls} aria-hidden="true">
      <span className="badge-medal__rim"><span className="badge-medal__disc" /></span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {hidden ? <span className="badge-medal__q">?</span> : <img className="badge-medal__img" src={`/badges/${img}.png`} alt="" loading="lazy" />}
      <span className="badge-medal__rib" />
    </span>
  );
}
