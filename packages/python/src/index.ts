import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface PythonDeclaration {
  readonly name: string;
  readonly kind: "Function" | "Class" | "Variable";
  readonly description: string;
  readonly signature: string;
  readonly members: ReadonlyArray<{
    readonly name: string;
    readonly signature: string;
    readonly description: string;
  }>;
}

export interface GeneratedPythonFile {
  readonly path: string;
  readonly content: string;
}

export interface PythonGenerationOptions {
  readonly title?: string;
  readonly description?: string;
  readonly baseUrl?: string;
  readonly root?: boolean;
  readonly python?: string;
}

export interface GeneratePythonFilesOptions extends PythonGenerationOptions {
  readonly input: string;
  readonly output: string;
}

const generatedManifestName = ".foldocs-python.json";

const extractor = String.raw`
import ast, json, pathlib, sys

filename = sys.argv[1]
source = pathlib.Path(filename).read_text(encoding="utf-8")
tree = ast.parse(source, filename=filename, type_comments=True)

def text(value):
    try:
        return ast.unparse(value)
    except Exception:
        return "Any"

def annotation(value):
    return text(value) if value is not None else None

def signature(node, prefix="def"):
    args = []
    positional = list(node.args.posonlyargs) + list(node.args.args)
    defaults = [None] * (len(positional) - len(node.args.defaults)) + list(node.args.defaults)
    for index, arg in enumerate(positional):
        value = arg.arg
        if annotation(arg.annotation): value += ": " + annotation(arg.annotation)
        if defaults[index] is not None: value += " = " + text(defaults[index])
        args.append(value)
        if node.args.posonlyargs and index + 1 == len(node.args.posonlyargs): args.append("/")
    if node.args.vararg:
        value = "*" + node.args.vararg.arg
        if annotation(node.args.vararg.annotation): value += ": " + annotation(node.args.vararg.annotation)
        args.append(value)
    elif node.args.kwonlyargs:
        args.append("*")
    for arg, default in zip(node.args.kwonlyargs, node.args.kw_defaults):
        value = arg.arg
        if annotation(arg.annotation): value += ": " + annotation(arg.annotation)
        if default is not None: value += " = " + text(default)
        args.append(value)
    if node.args.kwarg:
        value = "**" + node.args.kwarg.arg
        if annotation(node.args.kwarg.annotation): value += ": " + annotation(node.args.kwarg.annotation)
        args.append(value)
    result = prefix + " " + node.name + "(" + ", ".join(args) + ")"
    if annotation(node.returns): result += " -> " + annotation(node.returns)
    return result + ": ..."

result = []
for node in tree.body:
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not node.name.startswith("_"):
        prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
        result.append({"name": node.name, "kind": "Function", "description": ast.get_docstring(node) or "Function " + node.name + ".", "signature": signature(node, prefix), "members": []})
    elif isinstance(node, ast.ClassDef) and not node.name.startswith("_"):
        bases = [text(base) for base in node.bases]
        class_signature = "class " + node.name + (("(" + ", ".join(bases) + ")") if bases else "") + ": ..."
        members = []
        for member in node.body:
            if isinstance(member, (ast.FunctionDef, ast.AsyncFunctionDef)) and not member.name.startswith("_"):
                prefix = "async def" if isinstance(member, ast.AsyncFunctionDef) else "def"
                members.append({"name": member.name, "signature": signature(member, prefix), "description": ast.get_docstring(member) or ""})
        result.append({"name": node.name, "kind": "Class", "description": ast.get_docstring(node) or "Class " + node.name + ".", "signature": class_signature, "members": members})
    elif isinstance(node, (ast.Assign, ast.AnnAssign)):
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        for target in targets:
            if isinstance(target, ast.Name) and target.id.isupper():
                annotation_text = annotation(node.annotation) if isinstance(node, ast.AnnAssign) else None
                signature_text = target.id + ((": " + annotation_text) if annotation_text else "")
                result.append({"name": target.id, "kind": "Variable", "description": "Constant " + target.id + ".", "signature": signature_text, "members": []})

print(json.dumps(result, ensure_ascii=False))
`;

const isString = (value: unknown): value is string => typeof value === "string";

const decodeDeclarations = (
  value: unknown,
): ReadonlyArray<PythonDeclaration> => {
  if (!Array.isArray(value))
    throw new TypeError("Python extractor returned invalid JSON.");
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null)
      throw new TypeError("Python declaration must be an object.");
    const object = entry as Record<string, unknown>;
    if (
      !isString(object.name) ||
      !isString(object.description) ||
      !isString(object.signature) ||
      !["Function", "Class", "Variable"].includes(String(object.kind)) ||
      !Array.isArray(object.members)
    )
      throw new TypeError("Python declaration is missing required fields.");
    const members = object.members.map((member) => {
      if (typeof member !== "object" || member === null)
        throw new TypeError("Python member must be an object.");
      const item = member as Record<string, unknown>;
      if (
        !isString(item.name) ||
        !isString(item.signature) ||
        !isString(item.description)
      )
        throw new TypeError("Python member is missing required fields.");
      return {
        name: item.name,
        signature: item.signature,
        description: item.description,
      };
    });
    return {
      name: object.name,
      kind: object.kind as PythonDeclaration["kind"],
      description: object.description,
      signature: object.signature,
      members,
    };
  });
};

export const extractPythonApi = (
  input: string,
  options: Pick<PythonGenerationOptions, "python"> = {},
): Promise<ReadonlyArray<PythonDeclaration>> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      options.python ?? "python3",
      ["-c", extractor, path.resolve(input)],
      {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout
      .setEncoding("utf8")
      .on("data", (chunk: string) => (stdout += chunk));
    child.stderr
      .setEncoding("utf8")
      .on("data", (chunk: string) => (stderr += chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Python extraction failed (${String(code)}): ${stderr.trim()}`,
          ),
        );
        return;
      }
      try {
        resolve(decodeDeclarations(JSON.parse(stdout)));
      } catch (error) {
        reject(error);
      }
    });
  });

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "api";

const escapeYaml = (value: string): string => JSON.stringify(value);

export const generatePythonApiFiles = (
  declarations: ReadonlyArray<PythonDeclaration>,
  options: PythonGenerationOptions = {},
): ReadonlyArray<GeneratedPythonFile> => {
  const title = options.title ?? "Python API";
  const description = options.description ?? "Generated Python API reference.";
  const pages = declarations.map((declaration, index) => {
    const slug = slugify(declaration.name);
    const members = declaration.members.flatMap((member) => [
      `## ${member.name}`,
      "",
      member.description,
      "",
      "```python",
      member.signature,
      "```",
      "",
    ]);
    return {
      slug,
      file: {
        path: `${slug}.mdx`,
        content: [
          "---",
          `title: ${escapeYaml(declaration.name)}`,
          `description: ${escapeYaml(declaration.description)}`,
          `order: ${String(index + 2)}`,
          "tags:",
          "  - Python",
          `  - ${declaration.kind}`,
          "---",
          "",
          `# ${declaration.name}`,
          "",
          declaration.description,
          "",
          `**${declaration.kind}**`,
          "",
          "```python",
          declaration.signature,
          "```",
          "",
          ...members,
        ].join("\n"),
      },
    };
  });
  const baseUrl = options.baseUrl?.replace(/\/+$/u, "") ?? "";
  const index = [
    "---",
    `title: ${escapeYaml(title)}`,
    `description: ${escapeYaml(description)}`,
    "order: 1",
    "---",
    "",
    `# ${title}`,
    "",
    description,
    "",
    ...pages.flatMap(({ slug, file }, index) => [
      `## [${declarations[index]!.name}](${baseUrl.length === 0 ? `./${slug}` : `${baseUrl}/${slug}`})`,
      "",
      declarations[index]!.description,
      "",
    ]),
  ].join("\n");
  return [
    { path: "index.mdx", content: index },
    {
      path: "meta.json",
      content: JSON.stringify(
        {
          title,
          description,
          root: options.root ?? true,
          defaultOpen: true,
          pages: ["index", ...pages.map(({ slug }) => slug)],
        },
        null,
        2,
      ).concat("\n"),
    },
    ...pages.map(({ file }) => file),
  ];
};

export const generateFilesOnly = async (
  options: GeneratePythonFilesOptions,
): Promise<ReadonlyArray<GeneratedPythonFile>> =>
  generatePythonApiFiles(await extractPythonApi(options.input, options), {
    ...options,
    baseUrl: options.baseUrl ?? path.basename(path.resolve(options.output)),
  });

export const generateFiles = async (
  options: GeneratePythonFilesOptions,
): Promise<ReadonlyArray<GeneratedPythonFile>> => {
  const files = await generateFilesOnly(options);
  await fs.mkdir(options.output, { recursive: true });
  const manifestPath = path.join(options.output, generatedManifestName);
  const previous = await fs.readFile(manifestPath, "utf8").then(
    (source) => JSON.parse(source) as string[],
    (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    },
  );
  const next = new Set(files.map((file) => file.path));
  await Promise.all(
    previous
      .filter((file) => path.basename(file) === file && !next.has(file))
      .map((file) =>
        fs.unlink(path.join(options.output, file)).catch(() => undefined),
      ),
  );
  await Promise.all(
    files.map((file) =>
      fs.writeFile(path.join(options.output, file.path), file.content, "utf8"),
    ),
  );
  await fs.writeFile(
    manifestPath,
    JSON.stringify([...next].toSorted(), null, 2).concat("\n"),
    "utf8",
  );
  return files;
};
