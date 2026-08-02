import alchemy from 'alchemy'
import { Website } from 'alchemy/cloudflare'
import { CloudflareStateStore } from 'alchemy/state'

const app = await alchemy(
  '__FOLDOCS_PACKAGE_NAME__',
  process.env.ALCHEMY_STATE_TOKEN
    ? {
        stateStore: scope => new CloudflareStateStore(scope),
      }
    : undefined,
)

export const website = await Website('website', {
  build: 'npm run build',
  dev: 'npm run dev',
  assets: {
    directory: './dist',
    html_handling: 'auto-trailing-slash',
    not_found_handling: 'none',
  },
  spa: false,
})

console.log({ url: website.url })

await app.finalize()
