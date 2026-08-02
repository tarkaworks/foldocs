# Contributing Guide

Thank you for your interest in contributing to Foldocs. This guide explains how
to propose changes and run the project locally.

## Guidelines

Foldocs is a [Turborepo](https://turborepo.com/) monorepo managed with
[pnpm](https://pnpm.io/) and released with
[Tegami](https://tegami.fuma-nama.dev/).

### Before submitting

- Search the existing issues and pull requests for related work.
- Keep each pull request focused and explain the reason for the change.
- Run `pnpm format` before committing.
- Add a changelog with `pnpm tegami` when changing a published package.
- Run `pnpm check` and `pnpm test:e2e` before opening a pull request.

### New features

Open a feature request before starting a significant feature. Describe the use
case, expected behavior, and any alternatives you considered. Once the proposal
has been discussed, submit a focused pull request.

### Bug fixes

Include clear reproduction steps and describe the expected and actual behavior.
Link the related issue when one exists, and add or update tests that demonstrate
the fix where practical.

### Documentation

Documentation contributions are welcome. Check technical accuracy, spelling,
links, and examples before submitting. The documentation source is located in
[`apps/docs/content/docs`](./apps/docs/content/docs).

## Local development

### Prerequisites

- [Node.js](https://nodejs.org/) 24 or newer
- [pnpm](https://pnpm.io/) 10.28.2
- [Git](https://git-scm.com/)

### Setup

Fork the repository, then clone your fork:

```bash
git clone https://github.com/<your-username>/foldocs.git
cd foldocs
corepack enable
pnpm install
```

Build the workspace packages before starting the documentation app:

```bash
pnpm build
pnpm --filter foldocs-docs dev
```

The development server does not require additional environment variables.

### Checks

Run the same validation used by CI:

```bash
pnpm check
pnpm test:e2e
```

Individual checks are also available while iterating:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

## Pull requests

- Target the `main` branch.
- Link related issues and summarize the user-visible behavior.
- Include screenshots or recordings for visual changes.
- Ensure all required checks pass.
- Do not edit package versions manually; Tegami manages releases.
