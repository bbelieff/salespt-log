/**
 * 녹음 올리기 — multipart {file}(m4a·mp3·wav·aac·ogg·flac, 14MB 까지) 또는 JSON {text}(통화 앱이 만든 글자).
 * 녹음은 레포 밖 임시 폴더에 두고 정리 작업이 Gemini 로 보낸 뒤 바로 지운다. 하루 상한 CALL_DAILY_LIMIT(기본 30).
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { CallSummaryError, uploadCall } from "@/service/call-summary";
import { callResponse } from "../../response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => callResponse(req, true, async (who) => {
  const id = z.string().uuid().parse((await params).id);
  const type = req.headers.get("content-type") ?? "";
  if (type.startsWith("application/json")) {
    const { text } = z.object({ text: z.string() }).parse(await req.json());
    await uploadCall(who, id, { kind: "text", text });
  } else if (type.startsWith("multipart/form-data")) {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new CallSummaryError("녹음 파일을 골라 주세요", 400);
    await uploadCall(who, id, { kind: "audio", name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  } else {
    throw new CallSummaryError("녹음 파일이나 통화 글자를 보내 주세요", 400);
  }
  return { ok: true };
});
