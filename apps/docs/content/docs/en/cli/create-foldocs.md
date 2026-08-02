---
title: Create Foldocs
description: Generate a complete Foldkit documentation application with one command.
---

# Create Foldocs

```sh
pnpm create foldocs@latest my-docs
cd my-docs
pnpm dev
```

The scaffolder creates the Foldkit entry program, Effect runtime wiring, Vite
plugins, localized Markdown and MDX content, theme initialization, search,
prerendering, tests, and production build scripts.

## Non-interactive setup

Foldocs targets Foldkit, so it does not ask for a framework. Pass the required
directory as the positional argument and choose only the integrations the
project needs.

| Option                     | Behavior                                           |
| -------------------------- | -------------------------------------------------- |
| `--deployment none`        | Keep the project host-neutral; this is the default |
| `--deployment vercel`      | Add a static `vercel.json` for the generated app   |
| `--deployment cloudflare`  | Add Alchemy configuration and Cloudflare scripts   |
| `--package-manager <name>` | Use `pnpm`, `npm`, `yarn`, or `bun`                |
| `--no-install`             | Generate files without installing dependencies     |

For example:

```sh
pnpm create foldocs@latest my-docs --deployment vercel
pnpm create foldocs@latest my-docs --deployment cloudflare
```

Deployment integrations are opt-in. Without `--deployment`, the generated
project contains neither Alchemy nor Vercel configuration and can be deployed to
any static host later.

## Generated navigation

The starter demonstrates static section labels, collapsible manual-installation
pages, folder metadata, and a linked `index: true` folder page.

## First verification

Start the generated development server, open a nested route directly, then run
the production build and preview that same route from `dist`.
