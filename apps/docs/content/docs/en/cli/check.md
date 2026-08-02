---
title: Check documentation
description: Compile every page and catch route, link, heading, and locale problems.
---

# Check documentation

```sh
pnpm foldocs check \
  --locales en,es \
  --fallback-locale en
```

`foldocs check` compiles every `.md` and `.mdx` file, reports duplicate routes,
validates local document links and heading fragments, and understands locale
fallback.

## Options

| Option                       | Meaning                                    |
| ---------------------------- | ------------------------------------------ |
| `--content <directory>`      | Content root, defaulting to `content/docs` |
| `--base-path <path>`         | Documentation route prefix                 |
| `--locales <en,es>`          | Comma-separated locale list                |
| `--fallback-locale <locale>` | Source locale for missing translations     |

An optional positional root runs the check against another workspace.

## Link validation

Local documentation URLs and heading fragments are resolved against compiled
routes. Locale fallback is included, so missing source translations do not
produce false broken-link reports.

## CI usage

Run the command before the production build and fail the workflow on any
diagnostic. It performs no network writes and is safe for pull-request checks.
