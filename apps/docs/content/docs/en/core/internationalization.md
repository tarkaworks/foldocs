---
title: Internationalization
description: Resolve locale UI, content fallback, and stable translated routes.
icon: languages
---

# Internationalization

Locale configuration defines a code, display name, text direction, and optional
interface translation overrides. Missing labels fall back to Foldocs defaults.

## Content fallback

When a translated page is missing, the configured fallback locale supplies its
content while the requested locale keeps its own URL and navigation metadata.
This lets teams translate progressively without generating broken routes.

## Translation keys

Pages share a translation key derived from their path after locale and route
groups are removed. The Vite plugin uses that key for alternate links, search
indexes, `.md` routes, and prerender output.

## Right-to-left support

Set `dir: "rtl"` on a locale. Sidebar borders, logical padding, chevrons, page
context, and pagination use logical directions rather than hard-coded left and
right placement.
