import { foldocs } from "@foldocs/vite";
import { createTwoslashHighlighter } from "@foldocs/twoslash";
import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";

import docs from "./foldocs.config.js";
import { mdxComponents } from "./src/mdx-components.js";

export default defineConfig({
  plugins: [
    foldocs({
      ...docs,
      components: mdxComponents,
      highlightCode: createTwoslashHighlighter(),
    }),
    foldkit(),
  ],
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
