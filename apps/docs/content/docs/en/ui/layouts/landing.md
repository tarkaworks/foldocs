---
title: Landing layout
description: Configure the homepage hero, feature sections, shared navigation, and footer.
icon: home
---

# Landing layout

`landingLayout` renders the product homepage from `landing` configuration. It
shares the site brand, theme controls, language menu, social links, and footer
with documentation pages.

## Sections

The default composition keeps the page focused: hero, overview, features, and
one final call to action. Add the optional `stack`, `ai`, or `proof` sections in
`foldocs.config.ts` when they add information that is not already covered by
your feature copy.

The hero uses the same persistent header as the documentation layout, so the
site identity and navigation appear once rather than being repeated inside the
hero.

## Primary route

Point the main call to action at the documentation root or a dedicated getting
started page. Ensure that route is prerendered and represented in every locale.

## Footer

Use one footer configuration for landing and docs layouts so attribution,
copyright, source, and social links never drift between surfaces.
