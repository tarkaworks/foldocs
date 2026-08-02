import { promises as fs } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export interface GeneratedTypeScriptFile {
  readonly path: string
  readonly content: string
}

export interface TypeScriptGenerationOptions {
  readonly title?: string
  readonly description?: string
  readonly baseUrl?: string
  readonly root?: boolean
  readonly tsconfig?: string
}

export interface GenerateTypeScriptFilesOptions extends TypeScriptGenerationOptions {
  readonly input: string | ReadonlyArray<string>
  readonly output: string
}

interface ApiDeclaration {
  readonly name: string
  readonly kind: string
  readonly module: string
  readonly description: string
  readonly signature: string
}

const generatedManifestName = '.foldocs-typescript.json'

const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'api'

const escapeYaml = (value: string): string => JSON.stringify(value)

const commentText = (comment: ts.JSDoc['comment']): string => {
  if (typeof comment === 'string') return comment.trim()
  return (comment ?? [])
    .map(part => part.text)
    .join('')
    .trim()
}

const descriptionFor = (node: ts.Node, fallback: string): string => {
  const document = ts
    .getJSDocCommentsAndTags(node)
    .find((entry): entry is ts.JSDoc => ts.isJSDoc(entry))
  return commentText(document?.comment) || fallback
}

const declarationName = (node: ts.Statement): string | undefined => {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node)
  )
    return node.name?.getText()
  if (ts.isVariableStatement(node))
    return node.declarationList.declarations[0]?.name.getText()
  return undefined
}

const declarationKind = (node: ts.Statement): string => {
  if (ts.isFunctionDeclaration(node)) return 'Function'
  if (ts.isClassDeclaration(node)) return 'Class'
  if (ts.isInterfaceDeclaration(node)) return 'Interface'
  if (ts.isTypeAliasDeclaration(node)) return 'Type alias'
  if (ts.isEnumDeclaration(node)) return 'Enum'
  if (ts.isModuleDeclaration(node)) return 'Namespace'
  if (ts.isVariableStatement(node)) return 'Variable'
  return 'Declaration'
}

const isExported = (node: ts.Statement): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(
    modifier =>
      modifier.kind === ts.SyntaxKind.ExportKeyword ||
      modifier.kind === ts.SyntaxKind.DefaultKeyword,
  )

const compilerOptions = (
  tsconfig: string | undefined,
): { readonly options: ts.CompilerOptions; readonly files: string[] } => {
  if (tsconfig === undefined)
    return {
      options: {
        declaration: true,
        emitDeclarationOnly: true,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2023,
      },
      files: [],
    }
  const filename = path.resolve(tsconfig)
  const read = ts.readConfigFile(filename, ts.sys.readFile)
  if (read.error !== undefined)
    throw new TypeError(
      ts.flattenDiagnosticMessageText(read.error.messageText, '\n'),
    )
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(filename),
  )
  return {
    options: {
      ...parsed.options,
      declaration: true,
      emitDeclarationOnly: true,
      noEmit: false,
      removeComments: false,
    },
    files: parsed.fileNames,
  }
}

export const extractTypeScriptApi = (
  input: string | ReadonlyArray<string>,
  options: Pick<TypeScriptGenerationOptions, 'tsconfig'> = {},
): ReadonlyArray<ApiDeclaration> => {
  const roots = (Array.isArray(input) ? input : [input]).map(file =>
    path.resolve(file),
  )
  const config = compilerOptions(options.tsconfig)
  const declarations = new Map<string, string>()
  const program = ts.createProgram({
    rootNames: [...new Set([...config.files, ...roots])],
    options: config.options,
  })
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
  if (diagnostics.length > 0)
    throw new TypeError(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: file => file,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => '\n',
      }),
    )
  program.emit(
    undefined,
    (filename, content) => declarations.set(filename, content),
    undefined,
    true,
  )

  const result: ApiDeclaration[] = []
  for (const [filename, content] of declarations) {
    if (!filename.endsWith('.d.ts')) continue
    const source = ts.createSourceFile(
      filename,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )
    for (const node of source.statements) {
      if (!isExported(node)) continue
      const name = declarationName(node)
      if (name === undefined) continue
      const kind = declarationKind(node)
      result.push({
        name,
        kind,
        module: path.basename(filename, '.d.ts'),
        description: descriptionFor(node, `${kind} ${name}.`),
        signature: node.getFullText(source).trim(),
      })
    }
  }
  return result.sort((left, right) => left.name.localeCompare(right.name))
}

const pageFor = (
  declaration: ApiDeclaration,
  slug: string,
  order: number,
): GeneratedTypeScriptFile => ({
  path: `${slug}.mdx`,
  content: [
    '---',
    `title: ${escapeYaml(declaration.name)}`,
    `description: ${escapeYaml(declaration.description)}`,
    `order: ${String(order)}`,
    'tags:',
    '  - TypeScript',
    `  - ${escapeYaml(declaration.kind)}`,
    '---',
    '',
    `# ${declaration.name}`,
    '',
    declaration.description,
    '',
    `**${declaration.kind}** · \`${declaration.module}\``,
    '',
    '```ts twoslash',
    declaration.signature,
    '```',
    '',
  ].join('\n'),
})

export const generateTypeScriptApiFiles = (
  declarations: ReadonlyArray<ApiDeclaration>,
  options: TypeScriptGenerationOptions = {},
): ReadonlyArray<GeneratedTypeScriptFile> => {
  const title = options.title ?? 'TypeScript API'
  const description =
    options.description ?? 'Generated TypeScript API reference.'
  const seen = new Map<string, number>()
  const pages = declarations.map((declaration, index) => {
    const base = slugify(declaration.name)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    const slug = count === 1 ? base : `${base}-${slugify(declaration.module)}`
    return { declaration, slug, file: pageFor(declaration, slug, index + 2) }
  })
  const baseUrl = options.baseUrl?.replace(/\/+$/u, '') ?? ''
  const index = [
    '---',
    `title: ${escapeYaml(title)}`,
    `description: ${escapeYaml(description)}`,
    'order: 1',
    '---',
    '',
    `# ${title}`,
    '',
    description,
    '',
    ...pages.flatMap(({ declaration, slug }) => [
      `## [${declaration.name}](${baseUrl.length === 0 ? `./${slug}` : `${baseUrl}/${slug}`})`,
      '',
      `${declaration.kind} · ${declaration.description}`,
      '',
    ]),
  ].join('\n')
  const meta = JSON.stringify(
    {
      title,
      description,
      root: options.root ?? true,
      defaultOpen: true,
      pages: ['index', ...pages.map(({ slug }) => slug)],
    },
    null,
    2,
  ).concat('\n')
  return [
    { path: 'index.mdx', content: index },
    { path: 'meta.json', content: meta },
    ...pages.map(({ file }) => file),
  ]
}

export const generateFilesOnly = async (
  options: GenerateTypeScriptFilesOptions,
): Promise<ReadonlyArray<GeneratedTypeScriptFile>> =>
  generateTypeScriptApiFiles(
    extractTypeScriptApi(options.input, {
      ...(options.tsconfig === undefined ? {} : { tsconfig: options.tsconfig }),
    }),
    {
      ...options,
      baseUrl: options.baseUrl ?? path.basename(path.resolve(options.output)),
    },
  )

export const generateFiles = async (
  options: GenerateTypeScriptFilesOptions,
): Promise<ReadonlyArray<GeneratedTypeScriptFile>> => {
  const files = await generateFilesOnly(options)
  await fs.mkdir(options.output, { recursive: true })
  const manifestPath = path.join(options.output, generatedManifestName)
  const previous = await fs.readFile(manifestPath, 'utf8').then(
    source => JSON.parse(source) as string[],
    error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    },
  )
  const next = new Set(files.map(file => file.path))
  await Promise.all(
    previous
      .filter(
        file =>
          path.basename(file) === file &&
          file !== generatedManifestName &&
          !next.has(file),
      )
      .map(file =>
        fs.unlink(path.join(options.output, file)).catch(() => undefined),
      ),
  )
  await Promise.all(
    files.map(file =>
      fs.writeFile(path.join(options.output, file.path), file.content, 'utf8'),
    ),
  )
  await fs.writeFile(
    manifestPath,
    JSON.stringify([...next].toSorted(), null, 2).concat('\n'),
    'utf8',
  )
  return files
}
