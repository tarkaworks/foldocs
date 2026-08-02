---
title: Component library
description: Use the Foldkit-native component set included with every Foldocs application.
icon: library
---

# Component library

Foldocs UI includes the documentation primitives used throughout this site. They
compile into semantic Foldkit HTML, inherit theme tokens, and work in prerendered
output before the client runtime starts.

## Included primitives

- callouts for status and guidance
- cards for related destinations
- steps for ordered procedures
- tabs for alternative commands or implementations
- accordions for optional detail
- file trees for project structure
- highlighted code blocks with copy actions

## Use from MDX

Default components are registered automatically. Write their names directly in a
`.mdx` page; no per-page import is required.

## Override safely

Pass project renderers through `MdxComponents`. An override replaces only the
matching component, so applications can customize one primitive while retaining
the tested defaults for everything else.
