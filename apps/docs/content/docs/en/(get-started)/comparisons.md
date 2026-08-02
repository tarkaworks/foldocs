---
title: Comparisons
description: Decide when Foldocs is a better fit than a React-first documentation stack.
icon: scale
---

# Comparisons

## Shared documentation experience

Foldocs shares the authoring experience people expect from Fumadocs: filesystem
content, ordered page trees, polished layouts, local or hosted search, Markdown
endpoints, and LLM output. Its architectural boundary is different.

## Architectural differences

| Concern             | Foldocs                             | React-first docs frameworks           |
| ------------------- | ----------------------------------- | ------------------------------------- |
| Application runtime | Foldkit and Effect                  | React and framework-specific runtime  |
| Standard Markdown   | `@foldkit/markdown` typed AST       | Unified/MDX pipelines                 |
| Interactive state   | Typed Model and Message             | Component-local hooks                 |
| Static output       | Built-in deterministic prerender    | Framework adapter or server rendering |
| Search              | Effect interface with local default | Provider-specific integrations        |

## Choose the right stack

Choose Foldocs when the documentation belongs beside a Foldkit application, when
Effect is already part of the system, or when deterministic content and static
deployment are important. Choose another stack when React component compatibility
is a primary requirement.
