---
title: Social images
description: Generate static Open Graph and Twitter preview images for every documentation route.
tags:
  - integrations
  - metadata
---

# Social images

Foldocs can generate 1200×630 PNG previews during the Vite production build. No
runtime image endpoint or deployment-specific image service is required.
Takumi renders the cards directly to PNG with the bundled Inter variable font,
so output stays deterministic across development machines and CI runners.

## Enable generated images

```ts title="foldocs.config.ts"
import { defineConfig } from 'foldocs'

export default defineConfig({
  site: {
    title: 'Acme documentation',
    baseUrl: 'https://docs.example.com',
  },
  og: true,
})
```

The build emits a landing image and one image for every documentation page.
Titles and descriptions are taken from the same resolved frontmatter used by
the HTML route. New projects created with `create-foldocs` enable this by
default.

## Output paths

The default directory is `og`. With internationalization enabled, generated
paths include the locale:

```text
/og/en/home.png
/og/en/getting-started.png
/og/es/getting-started.png
```

Choose another directory when needed:

```ts
og: {
  directory: 'social'
}
```

The default dimensions can also be changed with `width` and `height`.

## Customize the template

Use `defineOgTemplate` to replace the default branded card. Templates receive
the route kind, page title and description, locale, site configuration,
dimensions, slug, and resolved logo SVG. Return an HTML string that Takumi can
render:

```ts title="foldocs.config.ts"
import { defineConfig, defineOgTemplate } from 'foldocs'

const socialCard = defineOgTemplate(
  ({ title, description, logoSvg }) => `
  <div style="width:100%;height:100%;display:flex;background:#1c1a20;color:#f7f5f8;padding:72px;font-family:Inter,sans-serif;">
    <div style="display:flex;flex-direction:column;justify-content:space-between;">
      <div style="width:48px;height:48px;color:#9bd32e;">${logoSvg}</div>
      <div>
        <div style="font-size:72px;font-weight:700;">${title}</div>
        ${description === undefined ? '' : `<div style="font-size:28px;color:#aaa4b2;margin-top:24px;">${description}</div>`}
      </div>
    </div>
  </div>
`,
)

export default defineConfig({
  site: {
    title: 'Acme documentation',
    baseUrl: 'https://docs.example.com',
  },
  og: {
    template: socialCard,
  },
})
```

The built-in template uses the Foldocs logo. Supply `og.logoSvg` to use a
project-specific SVG while keeping the rest of the default layout.

## Metadata

Prerendered routes receive `og:image`, `twitter:image`, and a
`summary_large_image` Twitter card. When `site.baseUrl` is configured, image
URLs are absolute.

## Override one page

Set `socialImage` in frontmatter to use a custom asset and skip generation for
that page:

```yaml
---
title: Launch announcement
socialImage: /images/launch.png
---
```

The same override is applied during client-side navigation, so route metadata
does not become stale after moving between pages.

## Static deployment

Generated images are ordinary build assets and work on Vercel, Cloudflare, and
any static host. Takumi only runs during the production build and adds no image
server or browser runtime to the deployed application.
