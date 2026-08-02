---
title: Document AST
description: Work with the portable block and inline node model.
icon: database
---

# Document AST

The AST uses Effect Schema codecs and discriminated `_tag` fields. Consumers can
exhaustively handle every content node without relying on renderer-specific
objects.

## Inline nodes

Text, inline code, hard breaks, emphasis, strong text, strikethrough, links,
images, and inline components form the inline union.

## Block nodes

Headings, paragraphs, code blocks, lists, blockquotes, thematic breaks, tables,
and block components form the block union.

## Portability

`documentToMarkdown` serializes the normalized document back to agent-friendly
Markdown. Root-relative links can be expanded with a production `baseUrl`, and
callouts or cards retain useful semantic fallbacks.
