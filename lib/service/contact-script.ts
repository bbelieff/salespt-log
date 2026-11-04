/** Layer: service — 컨택 대본. 고친 적 없으면 기본 대본(custom=false). */
import { DEFAULT_CONTACT_SCRIPT, DEFAULT_CONTACT_SMS } from "@/config/contact-script";
import { deleteContactScript, readContactScript, writeContactScript } from "@/repo/db/contact-scripts";
import type { ContactScript, ContactScriptView } from "@/types";

export async function getContactScript(email: string): Promise<ContactScriptView> {
  const saved = await readContactScript(email);
  return saved ? { ...saved, custom: true } : { script: DEFAULT_CONTACT_SCRIPT, sms: DEFAULT_CONTACT_SMS, custom: false };
}

export async function saveContactScript(email: string, value: ContactScript): Promise<ContactScriptView> {
  await writeContactScript(email, value);
  return { ...value, custom: true };
}

export async function resetContactScript(email: string): Promise<ContactScriptView> {
  await deleteContactScript(email);
  return { script: DEFAULT_CONTACT_SCRIPT, sms: DEFAULT_CONTACT_SMS, custom: false };
}
