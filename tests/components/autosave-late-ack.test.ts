// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useAutosave } from "@/components/autosave/useAutosave";

describe("late ACK must describe the current draft", () => {
  it.each([true,false])("does not mark newer staged input saved (valid=%s)", async valid => {
    (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT = true;
    let api!: ReturnType<typeof useAutosave<number>>;
    let release!: () => void;
    const gate = new Promise<void>(r => {release=r;});
    function Editor() {
      api = useAutosave({target:{student:"synthetic",row:1},initial:0,save:async()=>gate});
      return createElement("div",null,api.status);
    }
    const host = document.createElement("div");
    document.body.append(host); const root = createRoot(host);
    try {
      act(()=>root.render(createElement(Editor)));
      act(()=>api.update(1));
      let flush!: Promise<void>;
      act(()=>{flush=api.flush();});
      act(()=>api.stage(2,valid,valid ? undefined : "invalid latest"));
      await act(async()=>{release(); await flush;});
      expect(api.draft).toBe(2); expect(api.saved).toBe(1); expect(api.dirty).toBe(true);
      expect(api.status).toBe("idle");
      if (!valid) expect(api.error).toBe("invalid latest");
    } finally {act(()=>root.unmount());host.remove();}
  });
});
