import { Effect } from 'effect'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'
export const deploymentTargets = ['none', 'vercel', 'cloudflare'] as const
export type DeploymentTarget = (typeof deploymentTargets)[number]

export interface ScaffoldOptions {
  readonly directory: string
  readonly cwd?: string
  readonly deployment?: DeploymentTarget
  readonly install?: boolean
  readonly packageManager?: PackageManager
}

export interface ScaffoldResult {
  readonly directory: string
  readonly deployment: DeploymentTarget
  readonly packageManager: PackageManager
  readonly installed: boolean
}

export class ScaffoldError extends Error {
  readonly _tag = 'ScaffoldError'

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
  }
}

const templateDirectory = fileURLToPath(new URL('../template', import.meta.url))

const inferPackageManager = (): PackageManager => {
  const userAgent = process.env.npm_config_user_agent ?? ''
  if (userAgent.startsWith('bun/')) return 'bun'
  if (userAgent.startsWith('yarn/')) return 'yarn'
  if (userAgent.startsWith('npm/')) return 'npm'
  return 'pnpm'
}

const packageNameFromDirectory = (directory: string): string => {
  const fallback = 'foldocs-app'
  const normalized = path
    .basename(directory)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
  return normalized.replace(/^[._-]+|[._-]+$/gu, '') || fallback
}

const appendLine = async (file: string, line: string): Promise<void> => {
  const source = await fs.readFile(file, 'utf8')
  const lines = source.split(/\r?\n/gu)
  if (lines.includes(line)) return
  await fs.writeFile(file, `${source.trimEnd()}\n${line}\n`)
}

const installDependencies = (
  directory: string,
  packageManager: PackageManager,
) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(packageManager, ['install'], {
      cwd: directory,
      stdio: 'inherit',
      shell: false,
    })
    child.once('error', reject)
    child.once('exit', code => {
      if (code === 0) resolve()
      else
        reject(
          new Error(
            `${packageManager} install exited with code ${String(code)}.`,
          ),
        )
    })
  })

export const scaffold = (
  options: ScaffoldOptions,
): Effect.Effect<ScaffoldResult, ScaffoldError> =>
  Effect.tryPromise({
    try: async () => {
      const cwd = options.cwd ?? process.cwd()
      const directory = path.resolve(cwd, options.directory)
      const deployment = options.deployment ?? 'none'
      if (!deploymentTargets.includes(deployment)) {
        throw new ScaffoldError(`Unknown deployment target: ${deployment}`)
      }
      const existing = await fs.readdir(directory).catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
      })
      if (existing.length > 0) {
        throw new ScaffoldError(`Destination is not empty: ${directory}`)
      }
      await fs.mkdir(directory, { recursive: true })
      await fs.cp(templateDirectory, directory, { recursive: true })
      await fs.rename(
        path.join(directory, 'gitignore'),
        path.join(directory, '.gitignore'),
      )
      await fs.rename(
        path.join(directory, 'oxlintrc.json'),
        path.join(directory, '.oxlintrc.json'),
      )
      await fs.rename(
        path.join(directory, 'prettierrc'),
        path.join(directory, '.prettierrc'),
      )
      await fs.rename(
        path.join(directory, 'prettierignore'),
        path.join(directory, '.prettierignore'),
      )
      const packageName = packageNameFromDirectory(directory)
      const packageFile = path.join(directory, 'package.json')
      const packageJson = JSON.parse(
        await fs.readFile(packageFile, 'utf8'),
      ) as {
        name: string
        scripts: Record<string, string>
        devDependencies: Record<string, string>
      }
      packageJson.name = packageName

      const alchemyFile = path.join(directory, 'alchemy.run.ts')
      const environmentFile = path.join(directory, 'env.example')
      if (deployment === 'cloudflare') {
        packageJson.scripts['dev:cloudflare'] = 'alchemy dev'
        packageJson.scripts.deploy = 'alchemy deploy'
        packageJson.scripts.destroy = 'alchemy destroy'
        packageJson.devDependencies.alchemy = '0.93.12'

        const alchemySource = await fs.readFile(alchemyFile, 'utf8')
        await fs.writeFile(
          alchemyFile,
          alchemySource.replaceAll('__FOLDOCS_PACKAGE_NAME__', packageName),
        )
        await fs.rename(environmentFile, path.join(directory, '.env.example'))
        await appendLine(path.join(directory, '.gitignore'), '.alchemy')
        await appendLine(path.join(directory, '.prettierignore'), '.alchemy/')
      } else {
        await Promise.all([
          fs.rm(alchemyFile, { force: true }),
          fs.rm(environmentFile, { force: true }),
        ])
      }

      if (deployment !== 'vercel') {
        await fs.rm(path.join(directory, 'vercel.json'), { force: true })
      }

      await fs.writeFile(
        packageFile,
        `${JSON.stringify(packageJson, undefined, 2)}\n`,
      )
      const packageManager = options.packageManager ?? inferPackageManager()
      const install = options.install ?? true
      if (install) await installDependencies(directory, packageManager)
      return { directory, deployment, packageManager, installed: install }
    },
    catch: cause =>
      cause instanceof ScaffoldError
        ? cause
        : new ScaffoldError('Unable to create the Foldocs application.', cause),
  })
