---
title: What is Foldocs?
description: Understand the responsibilities Foldocs adds around a Foldkit application.
icon: circle-question-mark
---

# What is Foldocs?

Foldocs is a documentation framework built for Foldkit. It owns the repetitive
parts of documentation—content discovery, navigation, search, static rendering,
metadata, internationalization, and AI-readable output—while leaving you with a
normal Foldkit program that can be extended with typed models and messages.

## The core contract

Plain `.md` files are parsed by the official `@foldkit/markdown` package. Foldocs
adds page frontmatter, stable heading identifiers, syntax highlighting, search
text, and route metadata around that typed document. Deterministic `.mdx` is
available when a page needs registered inline or block components.

## Build output

A production build emits complete HTML for every route, sibling `.md` files,
localized search indexes, `llms.txt`, `llms-full.txt`, a sitemap, and the assets
referenced by your pages. The deployed site does not require a Node.js server.

:::Aside{type="tip"}
Foldocs is intentionally opinionated about the application framework: Foldkit is
the UI runtime and Effect powers commands, schemas, streams, and integrations.
:::

## Package boundaries

Core owns configuration and navigation, MDX owns the portable document model,
UI owns Foldkit views, and the CLI owns scaffolding and validation.
