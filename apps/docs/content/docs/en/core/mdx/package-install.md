---
title: Package install
description: Generate npm, pnpm, Yarn, and Bun commands from a single code fence.
---

# Package install

Use the `package-install` language with either package names or one npm command:

````md
```package-install
foldocs foldkit effect
```
````

Foldocs compiles the source into npm, pnpm, Yarn, and Bun commands. The UI keeps
the selected manager synchronized across every install block and remembers the
choice in the browser.

## Development dependencies

An npm command retains flags while being converted:

````md
```package-install
npm install --save-dev @foldocs/vite
```
````

The source Markdown route preserves the authored fence rather than serializing
four generated variants.
