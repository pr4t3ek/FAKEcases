import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * `next/core-web-vitals` is the ruleset Next ships; nothing custom on top, so
 * `pnpm lint` reports what the framework thinks is wrong and no house style of
 * its own. Type errors are `pnpm typecheck`'s job, not this one's.
 */
const config = [
  {
    ignores: [".next/**", "node_modules/**", "prisma/dev.db", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals"),
];

export default config;
