import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import { fileURLToPath } from "node:url";

export default defineConfig(() => ({
  plugins: process.env.VITEST
    ? [react()]
    : [
        react(),
        electron({
          main: {
            entry: "electron/main.ts",
          },
          preload: {
            input: "electron/preload.ts",
          },
          renderer: {},
        }),
      ],
  resolve: {
    alias: process.env.VITEST
      ? [
          {
            find: "expo-secure-store",
            replacement: fileURLToPath(new URL("./tests/mocks/expo-secure-store.ts", import.meta.url)),
          },
        ]
      : [],
  },
  server: {
    port: 5173,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.tsx"],
  },
}));
