---
title: Preview Markdown
description: Read Markdown and deterministic MDX without creating an application.
---

# Preview Markdown

```bash
pnpm foldocs preview ./notes
```

The dependency-free preview server compiles every `.md` and `.mdx` file using
the same Foldocs compiler, builds a small navigation list, and rereads the file
on every refresh.

```bash
pnpm foldocs preview ./SKILL.md --host 127.0.0.1 --port 4174
```

Use the full generated application when you need production navigation, search,
internationalization, or custom runtime components. Preview is intentionally a
fast reader for notes, skills, and isolated authoring.
