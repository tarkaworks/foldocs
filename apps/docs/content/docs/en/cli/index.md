---
title: Foldocs CLI
description: Scaffold applications, validate content, and generate owned customization files.
---

# Foldocs CLI

The Foldocs command-line tools cover two stages of the documentation lifecycle:
`create-foldocs` scaffolds a complete Foldkit application, and `foldocs`
validates or customizes an existing site.

## Commands

| Command               | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `pnpm create foldocs` | Generate a new application                    |
| `foldocs check`       | Compile content and validate local links      |
| `foldocs customize`   | Copy stable project-owned customization files |

Commands return non-zero exit codes for invalid input, compiler failures, or
validation errors, making them suitable for CI.

## Exit behavior

Invalid configuration, compilation failures, broken links, and unsafe overwrite
attempts return non-zero exit codes with actionable file diagnostics.

## Workspace targeting

Commands default to the current project. Positional roots and output options let
monorepos run validation or customization from a central task.
