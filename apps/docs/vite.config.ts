import { effectdocs } from "@effectdocs/vite";
import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";

import docs from "./effectdocs.config.js";

export default defineConfig({
  plugins: [effectdocs(docs), foldkit()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          if (
            id.includes("/node_modules/.pnpm/effect@") ||
            id.includes("/node_modules/effect/")
          )
            return "effect";
          if (
            id.includes("/node_modules/.pnpm/foldkit@") ||
            id.includes("/node_modules/foldkit/")
          )
            return "foldkit";
          return undefined;
        },
      },
    },
  },
});
