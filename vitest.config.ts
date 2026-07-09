import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Config mínima e isolada para testes unitários (Node), sem os plugins de
// SSR/Cloudflare do build principal. Resolve os aliases "@/..." via tsconfig.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
