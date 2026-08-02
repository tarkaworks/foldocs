---
title: Accessibility
description: Keyboard, focus, motion, and semantic guarantees in Foldocs UI.
---

# Accessibility

Foldocs builds its interactive controls from Foldkit Button, Menu, Disclosure,
and Dialog components. The generated attributes provide semantic roles,
expanded state, focus restoration, and outside-click behavior.

## Keyboard behavior

- `Command/Ctrl + K` opens search.
- `Escape` closes menus and dialogs.
- Arrow keys move through menu items.
- The `D` shortcut changes theme only outside editable controls.

## Focus and motion

Visible focus outlines are preserved for keyboard users. Disclosure and dialog
transitions respect `prefers-reduced-motion`, where durations collapse to a
near-instant fallback.

## Content semantics

The page title remains the only primary heading. Section anchors, pagination,
the table of contents, and sidebar navigation expose explicit accessible names.
