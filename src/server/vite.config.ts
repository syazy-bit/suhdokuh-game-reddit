import { defineConfig } from "vite";
import { builtinModules } from "node:module";
import { resolve } from "path";

export default defineConfig({
  ssr: {
    noExternal: true,
  },
  logLevel: "warn",
  build: {
    ssr: "index.ts",
    outDir: resolve(__dirname, "../../dist/server"),
    emptyOutDir: true,
    target: "node22",
    sourcemap: true,
    commonjsOptions: {
      ignoreDynamicRequires: true,
    },
    rollupOptions: {
      external: [...builtinModules],
      output: {
        format: "cjs",
        entryFileNames: "index.cjs",
        inlineDynamicImports: true,
      },
    },
  },
});
