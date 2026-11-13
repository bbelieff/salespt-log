/** 길찾기 주소 만들기(2026-11-07) — 앱별 검색 주소·앱 없을 때·폰 종류·검색어 고르기. 가상 주소만. */
import { describe, expect, it } from "vitest";
import { appUrl, detectPlatform, fallbackUrl, mapLaunch, mapQuery } from "@/util/map-links";

const Q = "경기 성남시 분당구 가상로 12";
const E = encodeURIComponent(Q);

describe("map-links", () => {
  it("세 앱 모두 주소가 검색된 화면 주소", () => {
    expect(appUrl("kakao", Q, "salesptlog.online")).toBe(`kakaomap://search?q=${E}`);
    expect(appUrl("naver", Q, "salesptlog.online")).toBe(`nmap://search?query=${E}&appname=salesptlog.online`);
    expect(appUrl("tmap", Q, "salesptlog.online")).toBe(`tmap://search?name=${E}`);
  });

  it("앱이 없으면 — 카카오·네이버는 웹 지도 검색, 티맵은 폰에 맞는 설치 화면", () => {
    expect(fallbackUrl("kakao", Q, "ios")).toBe(`https://map.kakao.com/link/search/${E}`);
    expect(fallbackUrl("naver", Q, "android")).toBe(`https://map.naver.com/p/search/${E}`);
    expect(fallbackUrl("tmap", Q, "ios")).toContain("apps.apple.com");
    expect(fallbackUrl("tmap", Q, "android")).toContain("play.google.com");
  });

  it("안드로이드는 intent 한 줄(앱 패키지 + 대신 갈 주소), 아이폰은 앱 주소 + 대신 갈 주소, PC는 웹 지도", () => {
    const a = mapLaunch("naver", Q, "android", "salesptlog.online");
    expect(a.open.startsWith("intent://search?query=")).toBe(true);
    expect(a.open).toContain("scheme=nmap;package=com.nhn.android.nmap;");
    expect(a.open).toContain(`S.browser_fallback_url=${encodeURIComponent(`https://map.naver.com/p/search/${E}`)}`);
    expect(a.fallback).toBeNull();
    expect(mapLaunch("kakao", Q, "ios", "x")).toEqual({ open: `kakaomap://search?q=${E}`, fallback: `https://map.kakao.com/link/search/${E}` });
    expect(mapLaunch("tmap", Q, "other", "x").open).toBe(`https://map.kakao.com/link/search/${E}`);
  });

  it("폰 종류", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; SM-S921N)")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("other");
  });

  it("검색어 — 장소가 주소면 장소, 「사무실」처럼 주소가 아니거나 비면 업체 소재지, 둘 다 없으면 장소 그대로", () => {
    expect(mapQuery("서울 강남구 가상로 5", "부산 가상구")).toBe("서울 강남구 가상로 5");
    expect(mapQuery("대표님 사무실", "경기 성남시 분당구 가상로 12")).toBe("경기 성남시 분당구 가상로 12");
    expect(mapQuery("", "경기 성남시 분당구 가상로 12")).toBe("경기 성남시 분당구 가상로 12");
    expect(mapQuery("가상카페", "")).toBe("가상카페");
    expect(mapQuery("", "")).toBe("");
  });
});

describe("routeCandidates — 길찾기 주소 후보 순서", () => {
  it("직접 적은 주소가 맨 앞", async () => {
    const { routeCandidates } = await import("@/util/map-links");
    expect(routeCandidates("김포 양촌", "경기 김포시 양촌읍 양곡리", "경기 김포시 양촌읍 황금로 117").map((c) => c.source)).toEqual(["own", "company"]);
  });
  it("번호까지 있는 미팅 장소는 소재지보다 앞, 주소 모양이 아닌 장소는 소재지가 있으면 뺀다", async () => {
    const { routeCandidates } = await import("@/util/map-links");
    expect(routeCandidates("서울 강남구 테헤란로 123", "경기 안산시 단원구 성곡로 176").map((c) => c.source)).toEqual(["place", "company"]);
    expect(routeCandidates("안산", "경기 안산시 단원구 성곡로 176").map((c) => c.source)).toEqual(["company"]);
  });
  it("소재지가 없으면 장소라도 쓰고, 둘 다 없으면 빈 목록 · 같은 주소는 한 번만", async () => {
    const { routeCandidates, isVagueAddress } = await import("@/util/map-links");
    expect(routeCandidates("김포 양촌", "")).toEqual([{ source: "place", address: "김포 양촌" }]);
    expect(routeCandidates("", undefined)).toEqual([]);
    expect(routeCandidates("성곡로 176", "성곡로 176")).toHaveLength(1);
    expect(isVagueAddress("경기 부천시 오정구 삼정동")).toBe(true);
    expect(isVagueAddress("경기 김포시 양촌읍 황금로 117")).toBe(false);
  });
});
