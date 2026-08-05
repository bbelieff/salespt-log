/**
 * Layer: types — 미팅(04 업체관리)·업체정보·영업관리 일별 행. 필드명: 시트 도메인=한국어(컬럼 1:1).
 * index.ts 배럴에서 재수출(2026-07-19, 500줄 캡 분리). 소비자는 `@/types` 유지.
 * SSOT: data-model.md · sheet-structure.md.
 */
import { z } from "zod";
import { Channel } from "./channel";

// ── 미팅 상태 (5종) ─────────────────────────────────────────
export const MeetingState = z.enum(["예약", "계약", "완료", "변경", "취소"]);
export type MeetingState = z.infer<typeof MeetingState>;

// ── 업체정보 (04 업체관리 T~AN, 미팅 단위 작성 — consultation-log §1-1) ──────
// [업체] 12(T~AE) + [대표자] 8(AF~AM) + 커스텀 JSON 1(AN)
// + 확장 3(AQ~AS — AO~AP 이월깃발 뒤 append, field-grid 2026-06-11).
// 모두 자유 텍스트, 빈값 허용. 기대출 2필드는 셀 내 `\n` 허용(Sheets 표준).
// 키는 식별자 안전형(업종주생산품목/사대보험직원). UI 라벨은 별도 매핑
// (과년도매출 = 표시 "과년도 매출 Y-1" — 키 유지로 라이브 데이터 보존).
export const CompanyInfo = z.object({
  // [업체] T~AE
  개업일: z.string().default(""),
  사업자구분: z.string().default(""),
  사업자등록번호: z.string().default(""),
  소재지: z.string().default(""),
  소유여부: z.string().default(""),
  업종주생산품목: z.string().default(""),
  과년도매출: z.string().default(""),
  금년도매출: z.string().default(""),
  기대출사업자: z.string().default(""),
  사대보험직원: z.string().default(""),
  특허및인증: z.string().default(""),
  업체기타메모: z.string().default(""),
  // [대표자] AF~AM
  대표자이름: z.string().default(""),
  연락처통신사: z.string().default(""),
  신용점수: z.string().default(""),
  기대출개인: z.string().default(""),
  자택주소지: z.string().default(""),
  대표소유여부: z.string().default(""),
  동종업계경력: z.string().default(""),
  대표기타메모: z.string().default(""),
  // 확장 3필드 (AQ~AS — field-grid 2026-06-11)
  대표자생년월일: z.string().default(""),
  과년도매출Y2: z.string().default(""),
  과년도매출Y3: z.string().default(""),
  // AN: "필드추가+" 커스텀(비정형) — {업체:{라벨:값}, 대표자:{라벨:값}}.
  커스텀: z
    .object({
      업체: z.record(z.string(), z.string()).default({}),
      대표자: z.record(z.string(), z.string()).default({}),
    })
    .partial()
    .optional(),
});
export type CompanyInfo = z.infer<typeof CompanyInfo>;

// ── 미팅 (04 업체관리(앱자동작성용) 1행 = 1미팅) ────────────────
// 시트 매핑 (sheet-structure.md §3, A~AN):
//   A=id, B=예약일, C=예약시각, D=미팅날짜, E=미팅시간, F=channel,
//   G=업체명, H=장소, I=예약비고, J=상태, K=계약여부, L=수임비,
//   M=미팅사유 (`업체명, 이유` 1줄),
//   N=표시상세(수식), O=표시요약(수식),
//   P=계약조건, Q=계약합성라인(수식),
//   R=previousMeetingId, S=주차(수식),
//   T~AN=업체정보(CompanyInfo, [업체]12+[대표자]8+커스텀JSON)
//
// ⚠️ N/O/Q/S는 시트 수식 자동 — 웹은 쓰지 않음. 읽기만 (optional).
export const Meeting = z.object({
  id: z.string(),
  예약일: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"), // B
  예약시각: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM"), // C
  미팅날짜: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"), // D
  미팅시간: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM (15분 단위)"), // E
  channel: Channel, // F
  업체명: z.string().min(1, "업체명 필수"), // G
  장소: z.string().min(1, "장소 필수"), // H — 2026-04-24 사양에서 필수
  예약비고: z.string().max(500).default(""), // I
  상태: MeetingState.default("예약"), // J
  계약여부: z.boolean().default(false), // K — J="계약"과 동기화 (호환용)
  수임비: z.number().int().nonnegative().default(0), // L (원) — v2 단위 통일
  미팅사유: z.string().default(""), // M `업체명, 이유` 1줄
  계약조건: z.string().default(""), // P (계약 시만)

  // 시트 수식 자동 (읽기 전용, 옵셔널)
  표시상세: z.string().optional(), // N
  표시요약: z.string().optional(), // O
  계약합성라인: z.string().optional(), // Q

  // 변경 추적 + 주차 (실제 시트의 R·S — v4 SSOT 누락분, repo는 유지)
  previousMeetingId: z.string().optional(), // R
  // S (수식). R4 W1-1(ADR-0031): 상한 제거 — 무제한 주차. 상한이 남아 있으면 11주+ 미팅이
  // safeParse 에 걸려 **행이 화면에서 통째로 사라진다**(PR-0 blocker 와 동형). types 레이어는
  // config import 금지(layers.test)라 MAX_SHEET_WEEK 를 못 쓰므로 상한 자체를 없앤다.
  주차: z.number().int().min(1).optional(),

  // 업체정보 (T~AN) — 미팅 단위. 빈값이면 undefined (rowToMeeting 이 내용 있을 때만 세팅).
  업체정보: CompanyInfo.optional(),

  // 이월 깃발 (AO~AP, arena-carryover §3) — "이월"=아레나 집계 제외, 미설정=native.
  // 마이그레이션만 기록(일반 쓰기 비접촉). 이월원본행id = 멱등 중복 가드.
  구분: z.string().optional(), // AO
  이월원본행id: z.string().optional(), // AP
  발굴id: z.string().optional(), // 어느 03 발굴에서 왔나(DB payload 전용·시트 컬럼 0). optional 고정=R11. lead-chain §4-5
});
export type Meeting = z.infer<typeof Meeting>;

// ── 영업관리 1행 = (날짜, 채널) 4지표 카운트 ─────────────────
// 01 영업관리 매주 28행 블록 안의 한 행. 웹은 4지표(E~H)만 직접 쓰기.
// I~P는 시트 수식 자동 집계 (절대 쓰기 금지).
export const ChannelDailyRow = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: Channel,
  production: z.number().int().nonnegative().default(0), // E
  inflow: z.number().int().nonnegative().default(0), // F
  contactProgress: z.number().int().nonnegative().default(0), // G
  meetingReservation: z.number().int().nonnegative().default(0), // H
});
export type ChannelDailyRow = z.infer<typeof ChannelDailyRow>;

// 일별 실적(DailyRevenue, 영업관리!Q~T)은 PR #38·39·40에서 02 계약수납관리로
// 모델 재정의되며 폐기됨. ContractPayment 타입 참조.
