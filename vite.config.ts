import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Config manual — substitui @lovable.dev/vite-tanstack-config.
// Redireciona a entry do servidor do TanStack Start para src/server.ts
// (nosso wrapper de erro de SSR).
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    // Nitro detecta o preset pelo ambiente (VERCEL=1 no build da Vercel);
    // localmente gera o preset node-server.
    nitro(),
    viteReact(),
  ],
});
