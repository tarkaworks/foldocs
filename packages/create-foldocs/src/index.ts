import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export interface ScaffoldOptions {
  readonly directory: string;
  readonly cwd?: string;
  readonly install?: boolean;
  readonly packageManager?: PackageManager;
}

export interface ScaffoldResult {
  readonly directory: string;
  readonly packageManager: PackageManager;
  readonly installed: boolean;
}

export class ScaffoldError extends Error {
  readonly _tag = "ScaffoldError";

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

const templateDirectory = fileURLToPath(
  new URL("../template", import.meta.url),
);

const inferPackageManager = (): PackageManager => {
  const userAgent = process.env.npm_config_user_agent ?? "";
  if (userAgent.startsWith("bun/")) return "bun";
  if (userAgent.startsWith("yarn/")) return "yarn";
  if (userAgent.startsWith("npm/")) return "npm";
  return "pnpm";
};

const packageNameFromDirectory = (directory: string): string => {
  const fallback = "foldocs-app";
  const normalized = path
    .basename(directory)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-");
  return normalized.replace(/^[._-]+|[._-]+$/gu, "") || fallback;
};

const installDependencies = (
  directory: string,
  packageManager: PackageManager,
) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(packageManager, ["install"], {
      cwd: directory,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${packageManager} install exited with code ${String(code)}.`,
          ),
        );
    });
  });

export const scaffold = (
  options: ScaffoldOptions,
): Effect.Effect<ScaffoldResult, ScaffoldError> =>
  Effect.tryPromise({
    try: async () => {
      const cwd = options.cwd ?? process.cwd();
      const directory = path.resolve(cwd, options.directory);
      const existing = await fs.readdir(directory).catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      });
      if (existing.length > 0) {
        throw new ScaffoldError(`Destination is not empty: ${directory}`);
      }
      await fs.mkdir(directory, { recursive: true });
      await fs.cp(templateDirectory, directory, { recursive: true });
      await fs.rename(
        path.join(directory, "gitignore"),
        path.join(directory, ".gitignore"),
      );
      const packageFile = path.join(directory, "package.json");
      const packageJson = await fs.readFile(packageFile, "utf8");
      await fs.writeFile(
        packageFile,
        packageJson.replace(
          "__FOLDOCS_PACKAGE_NAME__",
          packageNameFromDirectory(directory),
        ),
      );
      const packageManager = options.packageManager ?? inferPackageManager();
      const install = options.install ?? true;
      if (install) await installDependencies(directory, packageManager);
      return { directory, packageManager, installed: install };
    },
    catch: (cause) =>
      cause instanceof ScaffoldError
        ? cause
        : new ScaffoldError("Unable to create the Foldocs application.", cause),
  });
