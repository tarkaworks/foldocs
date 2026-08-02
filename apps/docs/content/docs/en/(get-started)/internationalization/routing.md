---
title: Locale routing
description: Understand locale prefixes, fallback pages, and canonical alternates.
---

# Locale routing

With i18n enabled, `/` redirects to the default locale landing page and docs are
served under paths such as `/en/docs` and `/es/docs`. Page slugs remain identical
across locales so switcher links can be generated deterministically.

When a translation is missing, Foldocs loads the fallback locale's source into
the requested route. Metadata records both the route locale and source locale,
which keeps search filtering, navigation, Markdown URLs, and alternate links
correct.

Use `dir: "rtl"` for right-to-left locales. Sidebar indentation, menus, pager
arrows, and layout borders use logical direction styles.
