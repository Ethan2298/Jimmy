import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      electron: resolve(__dirname, "src/main/__mocks__/electron.ts"),
      "uiohook-napi": resolve(__dirname, "src/main/__mocks__/uiohook-napi.ts"),
    },
  },
});
