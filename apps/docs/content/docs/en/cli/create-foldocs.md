---
title: Create Foldocs
description: Generate a complete Foldkit documentation application with one command.
icon: rocket
---

# Create Foldocs

```sh
pnpm create foldocs@latest my-docs
cd my-docs
pnpm install
pnpm dev
```

The scaffolder creates the Foldkit entry program, Effect runtime wiring, Vite
plugins, localized Markdown and MDX content, theme initialization, search,
prerendering, tests, and production build scripts.

## Non-interactive setup

Foldocs targets Foldkit, so it does not ask for a framework. Pass the directory
as the positional argument; when omitted, the CLI uses its documented default.

## Generated navigation

The starter demonstrates static section labels, collapsible manual-installation
pages, folder metadata, and a linked `index: true` folder page.

## First verification

Start the generated development server, open a nested route directly, then run
the production build and preview that same route from `dist`.
