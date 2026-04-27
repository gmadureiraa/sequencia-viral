import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Pacotes de landing experimentais (não importados pelo app principal)
    "packages/**",
    // Audit P2 (2026-04-27, Cursor): código legado/arquivado contaminava
    // lint com 100+ falsos positivos. Não é importado pelo app principal.
    "_archive/**",
    // Scripts de migração e seed que rodam só local — padrões diferentes
    // (process.exit, console.log) conflitam com regras de UI.
    "scripts/**",
  ]),
]);

export default eslintConfig;
