// ESLint 9 flat config — Next.js 15.
// 기존 .eslintrc.json("next/core-web-vitals" + no-img-element off)을 flat 형식으로 마이그레이션.
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "logs/**", "prototype/**"],
  },
];
