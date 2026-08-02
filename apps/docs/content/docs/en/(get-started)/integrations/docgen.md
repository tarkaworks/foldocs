---
title: Language references
description: Generate reference pages from TypeScript declarations and Python source.
---

# Language references

`@foldocs/typescript` uses the TypeScript compiler to emit public declarations
and documentation. `@foldocs/python` extracts public signatures and docstrings
through Python's AST without importing or executing the target module.

Both generators write managed MDX roots that can be reviewed, searched, and
prerendered like hand-authored content. Keep their output directory separate
from manually maintained guides so regeneration cannot overwrite editorial work.
