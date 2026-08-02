---
title: Versioning
description: Organize stable, preview, and archived documentation without changing the runtime.
---

# Versioning

Foldocs treats versions as content structure rather than runtime configuration.
Create one root folder per independently navigable version and point each folder
at its own pages.

```json
{
  "title": "v2",
  "description": "Current release",
  "root": true,
  "pages": ["index", "installation", "configuration"]
}
```

Keep canonical URLs stable for the current version when possible. Archived
versions can retain a path segment such as `/v1`, while a route group lets the
current version remain at short URLs.
