---
title: Static hosting
description: Deploy Foldocs to object storage, a CDN, or any directory-index host.
---

# Static hosting

Run the production build and upload the complete `dist` directory without
rewriting file names.

```sh
pnpm build
```

Configure these host behaviors:

- Serve `/path/index.html` when `/path` is requested.
- Preserve `.md`, `.json`, `.xml`, font, image, and hashed asset content types.
- Cache hashed assets immutably and HTML with a shorter policy.
- Return `dist/404.html` or the platform's 404 response for unknown paths.

Do not route every request to the root `index.html`; that would discard the
direct-navigation and no-JavaScript guarantees of prerendering.
