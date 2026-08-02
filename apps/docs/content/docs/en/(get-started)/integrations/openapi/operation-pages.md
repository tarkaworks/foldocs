---
title: Operation pages
description: Understand the deterministic reference generated for every OpenAPI operation.
---

# OpenAPI operation pages

Each HTTP operation becomes a normal Foldocs page. Generated output is Markdown
or deterministic MDX rather than a client-only API viewer, so it participates in
prerendering, search, `.md` routes, LLM files, and static deployment.

## Page identity

The generator prefers `operationId` for stable filenames. It falls back to the
HTTP method and route, normalizes duplicate slugs, and uses `summary` as the
display title when available.

## Parameters

Path-level and operation-level parameters are merged into a table containing
the name, location, required status, schema type, and description. Local JSON
Pointer references are resolved before rendering.

## Request bodies

The first declared media type is documented with its required status,
description, property table, and a generated example. Schema examples and
defaults take precedence over inferred placeholder values.

## Request examples

Every operation includes cURL and JavaScript `fetch` examples. The request URL
uses the first server in the OpenAPI document and falls back to
`https://api.example.com` when no server is declared.

## Responses

Response status, description, media type, schema fields, and example values are
rendered under individual headings, making them available to the table of
contents and local search.

## Customize generated navigation

Generation options can override the section title, description, link prefix,
root-folder behavior, and whether an index page and `meta.json` are emitted.
