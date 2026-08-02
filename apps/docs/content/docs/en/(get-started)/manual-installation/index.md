---
title: Manual installation
description: Add Foldocs to an existing Foldkit and Vite application.
icon: wrench
index: true
---

# Manual installation

Use manual installation when a Foldkit application already exists or when you
want to choose each package yourself. New documentation sites should normally
start with `pnpm create foldocs`.

## Required packages

Install `foldocs`, `foldkit`, `effect`, and `@effect/platform-browser`. Add
`@foldocs/vite` and `@foldkit/vite-plugin` as development dependencies.

## Required files

Create `foldocs.config.ts`, add the two Vite plugins, mount the generated Foldkit
program from `src/entry.ts`, and place localized content under
`content/docs/<locale>`. The package-manager pages contain ready-to-run commands.

## Required configuration

Set the content directory, route base, locales, site metadata, and landing-page
copy in `foldocs.config.ts`. Keep browser-safe configuration separate from build
credentials.
