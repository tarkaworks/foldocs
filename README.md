<p align="center">
  <img src="./apps/docs/public/favicon.svg" alt="Foldocs" width="96" height="96">
</p>

<h1 align="center">Foldocs</h1>

<p align="center">
  <a href="https://github.com/tarkaworks/foldocs/actions/workflows/ci.yml"><img alt="CI status" src="https://shieldcn.dev/github/ci/tarkaworks/foldocs.svg?workflow=ci.yml&amp;branch=main&amp;size=xs&amp;variant=outline&amp;mode=light"></a>
  <a href="https://www.npmjs.com/package/foldocs"><img alt="npm version" src="https://shieldcn.dev/npm/foldocs.svg?variant=outline&amp;size=xs&amp;mode=light"></a>
  <a href="https://github.com/tarkaworks/foldocs/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/stars/tarkaworks/foldocs.svg?variant=outline&amp;size=xs&amp;mode=light"></a>
  <a href="./LICENSE"><img alt="Apache 2.0 license" src="https://shieldcn.dev/badge/license-MIT.svg?size=xs&amp;variant=outline&amp;mode=light"></a>
</p>
<p align="center">
  <a href="https://github.com/tarkaworks"><img alt="Made by TarkaWorks" src="https://shieldcn.dev/badge/Made_by-TarkaWorks-000000.svg?size=xs"></a>
  <a href="https://x.com/tarkaworks"><img alt="Follow TarkaWorks on Twitter" src="https://shieldcn.dev/x/follow/tarkaworks.svg?size=xs&amp;variant=branded"></a>
  <a href="https://github.com/tarkaworks/foldocs/issues"><img alt="Join the community on GitHub" src="https://shieldcn.dev/badge/Join_the_community-GitHub.svg?logo=github&variant=branded&size=xs"></a>
</p>

[Foldocs](https://foldocs.vercel.app/) is a framework for building documentation websites with
[Foldkit](https://foldkit.dev/) and [Effect](https://effect.website/).

## Get Started

Create a Foldocs application and start the development server:

```bash
pnpm create foldocs@latest my-docs
cd my-docs
pnpm dev
```

Add `.md` or `.mdx` files to `content/docs`. Files become pages automatically,
while `meta.json` controls their order and sidebar grouping. See the
[documentation](https://foldocs.vercel.app/docs) for authoring, configuration,
internationalization, search, and customization.

## Deployment

Build the complete static site:

```bash
pnpm build
```

The generated `dist` directory contains prerendered HTML, Markdown routes,
localized search indexes, LLM files, and the sitemap. It can be deployed to any
static hosting provider.

### Cloudflare

Generated projects include [Alchemy](https://alchemy.run/) configuration for
deploying the static site to Cloudflare:

```bash
pnpm deploy
```

<p>
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/Tarkaworks/foldocs"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"></a>
</p>

### Vercel

The repository includes a [`vercel.json`](./vercel.json) that tells Vercel to
run `pnpm build` and publish `apps/docs/dist`. This configuration makes the
one-click deployment use the same fully static output without requiring a
serverless runtime. For a generated Foldocs application, use its local `dist`
directory as the output directory.

<p>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTarkaworks%2Ffoldocs"><img src="https://vercel.com/button" alt="Deploy with Vercel"></a>
</p>

## Community

The foldocs community lives on [GitHub](https://github.com/tarkaworks/foldocs), where you can [report bugs, request features, and share ideas](https://github.com/tarkaworks/foldocs/issues).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) to get the repo running locally and land a change, and use issues and discussions to collaborate. By participating, you agree to our [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

Published under the [MIT](./LICENSE) license.
