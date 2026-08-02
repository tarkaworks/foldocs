---
title: Search UI
description: Connect any Foldocs search provider to the accessible search dialog.
icon: search
---

# Search UI

The default search dialog is a Foldkit dialog with keyboard navigation, focus
containment, live loading state, and focus restoration.

## Provider boundary

The layout consumes `SearchClient`, not a provider SDK. Results are normalized to
URL, title, description, excerpt, and score before they reach the view.

## Keyboard behavior

- `⌘K` or `Ctrl+K` opens search.
- Arrow keys move through results.
- Enter navigates to the active result.
- Escape closes the dialog and restores the trigger.

## Empty and error states

Keep the current query visible while loading. Distinguish no matches from a
provider failure, and allow the user to retry without closing the dialog.
