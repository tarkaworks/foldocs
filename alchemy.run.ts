import alchemy from "alchemy";
import { Website } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";

const app = await alchemy(
  "foldocs-docs",
  process.env.ALCHEMY_STATE_TOKEN
    ? {
        stateStore: (scope) => new CloudflareStateStore(scope),
      }
    : undefined,
);

export const website = await Website("website", {
  name: "foldocs-docs",
  build: "pnpm --filter foldocs-docs build",
  dev: "pnpm --filter foldocs-docs dev",
  assets: {
    directory: "./apps/docs/dist",
    html_handling: "auto-trailing-slash",
    not_found_handling: "none",
  },
  spa: false,
});

console.log({ url: website.url });

await app.finalize();
