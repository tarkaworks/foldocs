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
the HTML route.

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
any static host. The generator uses `sharp` only during the build.
