/**
 * 공동인증서 찾기·요약(lib/util/npki-cert.ts). 인증서는 openssl 로 만든 가상 자체서명(가상 이름·번호, 실제 인증서 아님).
 */
import { describe, expect, it } from "vitest";
import { groupCertFiles, readNpkiCert } from "@/util/npki-cert";

// 개인 범용 정책(1.2.410.200005.1.1.1) · 만료 2027-12-13 · CN 김가상()0011234567890123
const PERSONAL = "MIICnjCCAgegAwIBAgIUU7EYbu1sQXspaeUnt2JwIohTT78wDQYJKoZIhvcNAQELBQAwbjELMAkGA1UEBhMCa3IxEDAOBgNVBAoMB3llc3NpZ24xFDASBgNVBAsMC3BlcnNvbmFsNElCMREwDwYDVQQLDAhYWOydgO2WiTEkMCIGA1UEAwwb6rmA6rCA7IOBKCkwMDExMjM0NTY3ODkwMTIzMB4XDTI2MTEwODIzNTg0M1oXDTI3MTIxMzIzNTg0M1owbjELMAkGA1UEBhMCa3IxEDAOBgNVBAoMB3llc3NpZ24xFDASBgNVBAsMC3BlcnNvbmFsNElCMREwDwYDVQQLDAhYWOydgO2WiTEkMCIGA1UEAwwb6rmA6rCA7IOBKCkwMDExMjM0NTY3ODkwMTIzMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDejd3QLr/Vvt9DmDzYJqm8sPKYRt39+Edh0KarzXYzWurdr8T1K+p3/nCCOGUv4STeu/7uYAyPgtedozQuao1+nHwK5pZmhNwtAnYmYnfZpAv+e1/cA36vyAzU7hPWS1VV9AGIuoSNbcFqs4bcQNK8yrjioFH3Pktr04GVhj5MdQIDAQABozkwNzAWBgNVHSAEDzANMAsGCSqDGoyaRQEBATAdBgNVHQ4EFgQUPlsapF/GbDCUce8uvx/qo7QYUOUwDQYJKoZIhvcNAQELBQADgYEA2/9u8pOf37yN8EExveGb9JEy9WNcHwIpC5pMt8NzNjw5FW5s7kYyyP4XTEwwdO3KQUqHNR//Q21XZE08lx41tOEHFEF8izweua6zyKFvnROX6iAB7+1HcwanKlaJUk5d+n40bIf2mQeS4kPCPxkSfczxIY7aHQ32HA+FrS7ZmlA=";
// 법인 범용 정책(1.2.410.200005.1.1.5) · 만료 2026-12-08 · CN (주)가상바다()0019876543210987
const CORP = "MIICtDCCAh2gAwIBAgIUfZ+Kt+zEsGeRN1Nsj7tIP7Uhr98wDQYJKoZIhvcNAQELBQAweTELMAkGA1UEBhMCa3IxEDAOBgNVBAoMB3llc3NpZ24xFzAVBgNVBAsMDmNvcnBvcmF0aW9uNEVDMREwDwYDVQQLDAhYWOydgO2WiTEsMCoGA1UEAwwjKOyjvCnqsIDsg4HrsJTri6QoKTAwMTk4NzY1NDMyMTA5ODcwHhcNMjYxMTA4MjM1ODQ0WhcNMjYxMjA4MjM1ODQ0WjB5MQswCQYDVQQGEwJrcjEQMA4GA1UECgwHeWVzc2lnbjEXMBUGA1UECwwOY29ycG9yYXRpb240RUMxETAPBgNVBAsMCFhY7J2A7ZaJMSwwKgYDVQQDDCMo7KO8KeqwgOyDgeuwlOuLpCgpMDAxOTg3NjU0MzIxMDk4NzCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEA2sxqWweDPoR7HIYfJde7gWa0qGUD8zJQZEiajf/kf/4xwlDRvFUshmYfuE6ZLDVpTPCVTlvcVSxNTkMdJ82EJN0D7phVdZj51f4SLwNctzvfT3t4jvgiGe5degnGm2Z7X0R5DEFOZdl95HOFktWxXRfN33LNzqjRqgVrFRj8X80CAwEAAaM5MDcwFgYDVR0gBA8wDTALBgkqgxqMmkUBAQUwHQYDVR0OBBYEFD/D1jbkkndidXnWSiuSxN7q03oGMA0GCSqGSIb3DQEBCwUAA4GBAMqloSewlCmiCbtgklI8D/TlruoFI5ks221OL7uiCQ2kkYu/W9aXcqfaM65bTl7wIxijkXHuG9hXim/P8f+e9pXKrb8wE0PZJ0ftqlj10TewTocKTseC1NusAROcZvkOXWBzVFYbNNqTgm7+7vykkIetafJReOgZoc9K79aMzGNG";
const der = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

describe("readNpkiCert", () => {
  it("개인 인증서 — 이름·발급기관·만료일·구분", () => {
    expect(readNpkiCert(der(PERSONAL), new Date("2026-11-09T00:00:00Z"))).toEqual({
      name: "김가상", kind: "개인", issuer: "금융결제원", notAfter: "2027-12-14", expired: false,
    });
  });
  it("법인 인증서 — 정책 OID 로 법인, 만료 지나면 expired", () => {
    const info = readNpkiCert(der(CORP), new Date("2027-01-01T00:00:00Z"));
    expect(info).toMatchObject({ name: "(주)가상바다", kind: "법인", issuer: "금융결제원", expired: true });
  });
  it("인증서가 아닌 바이트는 null", () => {
    expect(readNpkiCert(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(readNpkiCert(new Uint8Array(0))).toBeNull();
  });
});

describe("groupCertFiles", () => {
  const f = (path: string) => ({ path });
  it("NPKI 폴더 — 사용자 폴더마다 signCert+signPri 한 장, km 파일·다른 파일은 뺀다", () => {
    const out = groupCertFiles([
      f("NPKI/yessign/USER/cn=김가상/signCert.der"), f("NPKI/yessign/USER/cn=김가상/signPri.key"),
      f("NPKI/yessign/USER/cn=김가상/kmCert.der"), f("NPKI/yessign/USER/cn=김가상/kmPri.key"),
      f("NPKI/CrossCert/USER/cn=가상바다/signCert.der"), f("NPKI/CrossCert/USER/cn=가상바다/signPri.key"),
      f("NPKI/yessign/USER/cn=반쪽/signCert.der"), f("NPKI/readme.txt"),
    ]);
    expect(out.map(c => c.kind === "npki" && [c.dir, c.cert.path.split("/").pop(), c.key.path.split("/").pop()])).toEqual([
      ["NPKI/CrossCert/USER/cn=가상바다", "signCert.der", "signPri.key"],
      ["NPKI/yessign/USER/cn=김가상", "signCert.der", "signPri.key"],
    ]);
  });
  it("파일을 직접 고른 경우 — 이름이 달라도 .der·.key 하나씩이면 한 장, pfx 는 각각", () => {
    const out = groupCertFiles([f("내인증서.der"), f("내인증서.key"), f("법인.pfx"), f("백업.P12")]);
    expect(out.map(c => c.kind)).toEqual(["npki", "pfx", "pfx"]);
  });
  it(".der 만 있거나 두 쌍이 섞여 모호하면 묶지 않는다", () => {
    expect(groupCertFiles([f("a.der")])).toEqual([]);
    expect(groupCertFiles([f("a.der"), f("b.der"), f("a.key")])).toEqual([]);
  });
});
