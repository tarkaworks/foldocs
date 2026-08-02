---
title: Headless components
description: Compose documentation navigation and content with Foldkit views and typed state.
index: true
---

# Headless components

Fumadocs exposes React hooks and components from its Core package. Foldocs keeps
the same responsibilities headless but expresses them through pure Core helpers,
Foldkit views, and explicit application messages.

| Capability          | Foldocs API                                           |
| ------------------- | ----------------------------------------------------- |
| Breadcrumb context  | `navigationContextForUrl` from `foldocs-core`         |
| Documentation shell | `docsLayout` from `foldocs-ui`                        |
| Landing shell       | `landingLayout` from `foldocs-ui`                     |
| Markdown links      | `renderMarkdown` from `foldocs-ui`                    |
| Table of contents   | `CompiledPage.toc` plus `DocsLayoutActions.selectToc` |

There are no React providers or hooks. State stays in the Effect/Foldkit
program, and view functions remain deterministic.

## Package boundary

`foldocs-core` derives serializable navigation state. `foldocs-ui` turns that
state into Foldkit HTML. The `foldocs` runtime owns browser effects such as
scrolling, intersection observation, clipboard access, and URL navigation.
