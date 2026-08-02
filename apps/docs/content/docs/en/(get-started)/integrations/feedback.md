---
title: Feedback
description: Collect page-level documentation ratings through your own endpoint.
tags:
  - integrations
  - analytics
---

# Feedback

Foldocs includes an optional page-level feedback control. It owns the accessible
UI and request lifecycle while your application owns storage, authentication,
analytics, and retention.

## Configure the endpoint

```ts title="foldocs.config.ts"
import { defineConfig } from 'foldocs'

export default defineConfig({
  feedback: {
    endpoint: '/api/docs-feedback',
    prompt: 'Did this page answer your question?',
  },
})
```

The prompt is optional. Localized default labels are used for the positive and
negative actions, success message, and failure message.

## Request contract

Selecting a rating sends a JSON request:

```http
POST /api/docs-feedback
Content-Type: application/json

{"url":"/en/docs/search","rating":"positive"}
```

`rating` is either `positive` or `negative`. Any non-2xx response moves the UI
to its error state; a successful response replaces the actions with the
localized thank-you message.

## Endpoint responsibilities

- Validate the route and rating instead of trusting browser input.
- Apply rate limiting when the endpoint is public.
- Avoid placing provider credentials in the generated browser bundle.
- Return a successful status only after the event has been accepted.

## Provider integrations

The endpoint can forward the event to PostHog, an internal analytics service, a
database, or an issue workflow. Foldocs deliberately does not require a provider
SDK and does not collect feedback when `feedback` is omitted.

## Current scope

The built-in control rates an entire page. Selection-based or block-level
feedback is not currently part of the Foldocs runtime.
