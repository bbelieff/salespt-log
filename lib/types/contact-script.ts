/** 컨택 대본·문자양식 — 로그인 계정마다 한 벌(DB contact_scripts). 기본값은 lib/config/contact-script.ts. */
import { z } from "zod";

export const ContactScript = z.object({
  script: z.string().max(20_000),
  sms: z.string().max(5_000),
});
export type ContactScript = z.infer<typeof ContactScript>;

/** GET 응답 — custom=false 면 아직 고친 적 없는 기본 대본. */
export interface ContactScriptView extends ContactScript { custom: boolean }
