import tseslint from "typescript-eslint";
export default tseslint.config({ ignores: [".next/**", "out/**", "node_modules/**", "public/**", "test-results/**", "next-env.d.ts"] }, ...tseslint.configs.recommended, { rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] } });
