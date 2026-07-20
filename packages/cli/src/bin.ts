#!/usr/bin/env node

import { Effect } from "effect";

import { check } from "./index.js";

const help = `effectdocs

Usage:
  effectdocs check [root] [--content <directory>] [--base-path <path>]

Commands:
  check  Compile every page and report duplicate routes and broken local links
`;

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  process.stdout.write(help);
  process.exit(0);
}

if (args[0] !== "check") {
  process.stderr.write(`${help}\nUnknown command: ${args[0] ?? ""}\n`);
  process.exit(1);
}

const valueAfter = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

const root = args.slice(1).find((argument, index, list) => {
  if (argument.startsWith("-")) return false;
  const previous = list[index - 1];
  return previous !== "--content" && previous !== "--base-path";
});

Effect.runPromise(
  check({
    ...(root === undefined ? {} : { root }),
    ...(valueAfter("--content") === undefined
      ? {}
      : { contentDir: valueAfter("--content")! }),
    ...(valueAfter("--base-path") === undefined
      ? {}
      : { basePath: valueAfter("--base-path")! }),
  }),
).then(
  (result) => {
    for (const issue of result.issues) {
      process.stderr.write(
        `${issue.level.toUpperCase()} ${issue.file}: ${issue.message}\n`,
      );
    }
    process.stdout.write(
      `${result.valid ? "✓" : "✗"} Checked ${String(result.pages)} documentation pages.\n`,
    );
    if (!result.valid) process.exitCode = 1;
  },
  (error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  },
);
