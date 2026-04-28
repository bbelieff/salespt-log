import { defineConfig } from "vitest/config";
import path from "node:path";

const root = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    // tsconfig.json paths와 1:1 대응 (구체적 → 일반 순서)
    alias: [
      { find: /^@\/types$/, replacement: root("lib/types/index.ts") },
      { find: /^@\/config$/, replacement: root("lib/config/index.ts") },
      { find: /^@\/service$/, replacement: root("lib/service/index.ts") },
      { find: /^@\/types\/(.*)$/, replacement: root("lib/types/$1") },
      { find: /^@\/config\/(.*)$/, replacement: root("lib/config/$1") },
      { find: /^@\/repo\/(.*)$/, replacement: root("lib/repo/$1") },
      { find: /^@\/service\/(.*)$/, replacement: root("lib/service/$1") },
      { find: /^@\/(.*)$/, replacement: root("$1") },
    ],
  },
});
