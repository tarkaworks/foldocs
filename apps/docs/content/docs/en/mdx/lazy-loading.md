---
title: Lazy loading
description: Keep page bodies and search corpora out of the initial browser bundle automatically.
---

# Lazy loading

Foldocs enables lazy document loading by default. There is no collection-level
`async` or `dynamic` flag to configure.

## Manifest split

The `virtual:foldocs` manifest eagerly contains serializable route metadata. Each
entry exposes `load()`, which Vite compiles to a dynamic import for that page.

```ts
const entry = manifest.find(page => page.url === location.pathname)
const page = entry === undefined ? undefined : await entry.load()
```

Navigation can render the full page tree without importing every document body.

## Local and adapter pages

Filesystem content and adapter-provided content use the same lazy module shape.
Remote content is fetched by the adapter during the build, then emitted as a
normal static route chunk; provider credentials never reach the client.

## Prerendered entry

Production HTML already contains the current document. Foldocs preloads only its
matching page module before starting the Foldkit runtime, then adopts the static
tree without showing an intermediate loading screen.

## Search indexes

With `search.staticIndex` enabled, navigation metadata omits page text and each
locale's search index is fetched only when search is first used.

## Runtime compilation

Foldocs does not compile author-controlled MDX in the browser. If content truly
must be compiled on demand, use the [standalone compiler](/en/docs/mdx/runtime-compilation)
in a trusted Node.js or Bun environment and validate the resulting
`CompiledPage` before storage or delivery.
