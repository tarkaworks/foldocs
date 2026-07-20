#!/usr/bin/env node

import { Effect } from "effect";

import { check, customize, type Customization } from "./index.js";

const help = `foldocs

Usage:
  foldocs check [root] [--content <directory>] [--base-path <path>]
                   [--locales <en,es>] [--fallback-locale <locale>]
  foldocs customize [theme|layout|mdx-components|all] [root]
                    [--output <directory>] [--force]

Commands:
  check  Compile every page and report duplicate routes and broken local links
  customize  Copy project-owned theme, layout, or MDX component source
`;

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  process.stdout.write(help);
  process.exit(0);
}

if (args[0] !== "check" && args[0] !== "customize") {
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
  return ![
    "--content",
    "--base-path",
    "--locales",
    "--fallback-locale",
    "--output",
  ].includes(previous ?? "");
});

if (args[0] === "customize") {
  const selection = args[1]?.startsWith("-") ? undefined : args[1];
  const allowed: ReadonlyArray<Customization | "all"> = [
    "theme",
    "layout",
    "mdx-components",
    "all",
  ];
  if (
    selection !== undefined &&
    !allowed.includes(selection as Customization)
  ) {
    process.stderr.write(`Unknown customization: ${selection}\n`);
    process.exit(1);
  }
  const components: ReadonlyArray<Customization> =
    selection === "all"
      ? ["theme", "layout", "mdx-components"]
      : selection === undefined
        ? ["theme", "layout"]
        : [selection as Customization];
  const positionalRoot = args
    .slice(selection === undefined ? 1 : 2)
    .find((argument, index, list) => {
      if (argument.startsWith("-")) return false;
      return list[index - 1] !== "--output";
    });
  Effect.runPromise(
    customize({
      ...(positionalRoot === undefined ? {} : { root: positionalRoot }),
      ...(valueAfter("--output") === undefined
        ? {}
        : { outputDir: valueAfter("--output")! }),
      components,
      force: args.includes("--force"),
    }),
  ).then(
    (result) => {
      for (const file of result.files) process.stdout.write(`✓ ${file}\n`);
      if (components.includes("mdx-components"))
        process.stdout.write(
          "Merge customMdxComponents into the registry passed to createDocsProgram.\n",
        );
    },
    (error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    },
  );
} else {
  const locales = valueAfter("--locales")
    ?.split(",")
    .map((locale) => locale.trim())
    .filter(Boolean);

  Effect.runPromise(
    check({
      ...(root === undefined ? {} : { root }),
      ...(valueAfter("--content") === undefined
        ? {}
        : { contentDir: valueAfter("--content")! }),
      ...(valueAfter("--base-path") === undefined
        ? {}
        : { basePath: valueAfter("--base-path")! }),
      ...(locales === undefined ? {} : { locales }),
      ...(valueAfter("--fallback-locale") === undefined
        ? {}
        : { fallbackLocale: valueAfter("--fallback-locale")! }),
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
}
