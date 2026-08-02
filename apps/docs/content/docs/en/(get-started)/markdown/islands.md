---
title: Typed islands
description: Validate directive attributes with Effect Schema and render typed Foldkit views.
---

# Typed islands

## Define an island

An island is a leaf or container directive in a `.md` page. Define its attributes
with Effect Schema, pass the definitions to `markdownOptions.islands`, and create
runtime views with `@foldkit/markdown`'s `islandsFor` helper.

```md
:::Aside{type="tip"}
The body remains ordinary typed Markdown.
:::
```

## Validate attributes

The same definitions reject unknown island names, extra attributes, and invalid
values during development and production builds. `islandsFor` decodes those
attributes again before invoking the view and provides a stable occurrence index
for repeated stateful islands.

## Generated example

:::Aside{type="tip"}
The generated application already includes a typed `Aside` definition and view
in `src/markdown-islands.ts`.
:::
