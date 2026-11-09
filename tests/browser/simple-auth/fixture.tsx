/** 간편인증 서류 조회 목업 — 셸 없이 본문만(빠른 확인용). 라이브 셸 버전은 tests/browser/simple-auth-live. */
import { createRoot } from "react-dom/client";
import SimpleAuthMock from "./SimpleAuthMock";

createRoot(document.getElementById("root")!).render(<SimpleAuthMock />);
