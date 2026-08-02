---
title: Theme
description: Configure Foldocs colors, typography, dimensions, and dark mode without forking UI code.
icon: settings
---

# Theme

Foldocs exposes stable CSS variables for the visual system and uses the same
tokens across layouts and Markdown components.

## Core tokens

```css
:root {
  --fd-primary: #163a2d;
  --fd-background: #ffffff;
  --fd-foreground: #1f1f24;
  --fd-sidebar-width: 16rem;
  --fd-toc-width: 16.75rem;
  --fd-radius: 0.625rem;
}

.dark {
  --fd-primary: #8dd8b8;
  --fd-background: #1d1b20;
}
```

## Initial theme

The generated HTML applies the saved or system theme before the application
mounts. Keep this inline bootstrap when customizing the shell so a dark page does
not flash light during refresh.

## Project ownership

Run `foldocs customize theme` to create an override file under `src/foldocs`.
Upgrade package CSS independently and keep brand decisions in the application.
