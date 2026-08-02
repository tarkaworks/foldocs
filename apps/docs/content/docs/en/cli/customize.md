---
title: Customize source
description: Copy theme, layout, or MDX renderer entry points into your project.
icon: settings
---

# Customize source

```sh
pnpm foldocs customize all
```

Choose `theme`, `layout`, `mdx-components`, or `all`. Theme and layout selections
are imported into `src/styles.css`; the MDX selection exports a component
registry ready to merge into `createDocsProgram`.

## Options

- `--output <directory>` changes the generated directory.
- `--force` replaces existing customization files.
- A positional root targets another workspace.

Without `--force`, existing files produce an error instead of being silently
overwritten.

## Generated files

Theme and layout output is imported automatically. The MDX component registry
is intentionally explicit so teams can review which project renderers override
Foldocs defaults.

## Upgrade responsibility

Copied files belong to the application. Review upstream changes before merging
new framework releases rather than overwriting local behavior automatically.
