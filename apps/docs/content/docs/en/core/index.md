---
title: Foldocs Core
description: Typed configuration, manifests, navigation, and localization primitives.
icon: album
---

# Foldocs Core

`foldocs-core` is the framework-independent contract between content discovery,
the Vite integration, and Foldkit views. It contains no browser renderer and no
filesystem crawler.

## Public entry points

| Entry point               | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `foldocs-core/config`     | Effect Schema configuration and resolved defaults |
| `foldocs-core/manifest`   | Page lookup and adjacent-page helpers             |
| `foldocs-core/navigation` | Folders, separators, roots, and layout tabs       |

## Headless feature map

Foldocs splits the responsibilities grouped into `fumadocs-core` across small
packages:

| Responsibility         | Foldocs package    |
| ---------------------- | ------------------ |
| Configuration and tree | `foldocs-core`     |
| Content contracts      | `@foldocs/content` |
| Markdown compilation   | `foldocs-mdx`      |
| Foldkit views          | `foldocs-ui`       |
| Search contracts       | `@foldocs/search`  |
| Discovery and output   | `@foldocs/vite`    |

The Core documentation follows those capabilities even when the implementation
lives in a neighboring package.

## Why it is separate

Adapters can create the same page metadata whether content comes from the local
filesystem, a CMS, OpenAPI, AsyncAPI, or a language-reference generator. Core
turns that metadata into stable application state without depending on the
source. Start with the [page tree](/en/docs/core/page-tree) and
[content source contract](/en/docs/core/content-sources).

## Runtime independence

Core exports plain typed values, Effect schemas, and deterministic helpers. It
does not depend on a browser renderer, which keeps adapters, generators, and
build tools reusable.
