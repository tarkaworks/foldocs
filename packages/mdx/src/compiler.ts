import {
  PageFrontmatter,
  TocItem,
  decodePageFrontmatter,
  type PageFrontmatter as PageFrontmatterType,
  type TocItem as TocItemType,
} from "@effectdocs/content";
import GithubSlugger from "github-slugger";
import type {
  BlockContent as MdastBlockContent,
  ListItem as MdastListItem,
  PhrasingContent,
  Root,
  RootContent,
  Table as MdastTable,
} from "mdast";
import type {} from "mdast-util-directive";
import type {} from "mdast-util-mdx-jsx";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { codeToHtml } from "shiki";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";

import type {
  Block,
  BlockComponent,
  Inline,
  InlineComponent,
  Table,
  TableRow,
} from "./ast.js";
import { Document } from "./ast.js";
import { Schema as S } from "effect";

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkMdx)
  .freeze();

export const CompiledPage = S.Struct({
  frontmatter: PageFrontmatter,
  document: Document,
  toc: S.Array(TocItem),
  source: S.String,
  plainText: S.String,
});
export type CompiledPage = typeof CompiledPage.Type;

export interface CompileOptions {
  readonly filePath?: string;
  readonly highlight?: boolean;
}

type NodeWithPosition = Readonly<{
  type: string;
  position?: Readonly<{ start: Readonly<{ line: number }> }> | undefined;
}>;

const location = (node: NodeWithPosition, filePath?: string): string => {
  const file = filePath === undefined ? "" : `${filePath}`;
  const line = node.position?.start.line;
  if (file.length === 0 && line === undefined) return "";
  return ` (${file}${line === undefined ? "" : `:${line}`})`;
};

const unsupported = (
  node: NodeWithPosition,
  filePath: string | undefined,
  guidance?: string,
): never => {
  throw new Error(
    `Unsupported MDX node "${node.type}"${location(node, filePath)}.${
      guidance === undefined ? "" : ` ${guidance}`
    }`,
  );
};

const safeUrl = (
  url: string,
  node: NodeWithPosition,
  filePath?: string,
): string => {
  const compact = url.replace(/[\u0000-\u0020]/gu, "");
  if (
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(compact) &&
    !/^(?:https?|mailto|tel):/iu.test(compact)
  ) {
    throw new Error(
      `Unsafe URL scheme in "${url}"${location(node, filePath)}.`,
    );
  }
  return url;
};

const attributesFromMdx = (
  node: {
    attributes?: ReadonlyArray<
      | {
          type: "mdxJsxAttribute";
          name: string;
          value?: string | null | object;
        }
      | { type: string }
    >;
  },
  filePath?: string,
): Readonly<Record<string, string>> => {
  const attributes: Record<string, string> = {};
  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== "mdxJsxAttribute" || !("name" in attribute)) {
      unsupported(
        { type: attribute.type },
        filePath,
        "Spread attributes are not deterministic and cannot be statically indexed.",
      );
    }
    const literalAttribute = attribute as {
      readonly type: "mdxJsxAttribute";
      readonly name: string;
      readonly value?: string | null | object;
    };
    if (
      literalAttribute.value !== undefined &&
      literalAttribute.value !== null &&
      typeof literalAttribute.value !== "string"
    ) {
      unsupported(
        { type: "mdx attribute expression" },
        filePath,
        "Use a literal string attribute. Interactive values belong in a Foldkit component model.",
      );
    }
    attributes[literalAttribute.name] =
      typeof literalAttribute.value === "string" ? literalAttribute.value : "";
  }
  return attributes;
};

const attributesFromDirective = (
  attributes:
    Readonly<Record<string, string | null | undefined>> | null | undefined,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(attributes ?? {}).map(([name, value]) => [
      name,
      value ?? "",
    ]),
  );

const inlineText = (content: ReadonlyArray<Inline>): string =>
  content
    .map((node) => {
      switch (node._tag) {
        case "Text":
        case "InlineCode":
          return node.value;
        case "HardBreak":
          return "\n";
        case "Emphasis":
        case "Strong":
        case "Strikethrough":
        case "Link":
        case "InlineComponent":
          return inlineText(node.content);
        case "Image":
          return node.alt;
      }
    })
    .join("");

const normalizeInline = (
  node: PhrasingContent | Record<string, unknown>,
  filePath?: string,
): Inline => {
  switch (node.type) {
    case "text":
      return { _tag: "Text", value: String(node.value) };
    case "inlineCode":
      return { _tag: "InlineCode", value: String(node.value) };
    case "break":
      return { _tag: "HardBreak" };
    case "emphasis":
      return {
        _tag: "Emphasis",
        content: (node.children as PhrasingContent[]).map((child) =>
          normalizeInline(child, filePath),
        ),
      };
    case "strong":
      return {
        _tag: "Strong",
        content: (node.children as PhrasingContent[]).map((child) =>
          normalizeInline(child, filePath),
        ),
      };
    case "delete":
      return {
        _tag: "Strikethrough",
        content: (node.children as PhrasingContent[]).map((child) =>
          normalizeInline(child, filePath),
        ),
      };
    case "link": {
      const title = node.title;
      return {
        _tag: "Link",
        url: safeUrl(String(node.url), node as NodeWithPosition, filePath),
        ...(typeof title === "string" ? { title } : {}),
        content: (node.children as PhrasingContent[]).map((child) =>
          normalizeInline(child, filePath),
        ),
      };
    }
    case "image": {
      const title = node.title;
      return {
        _tag: "Image",
        url: safeUrl(String(node.url), node as NodeWithPosition, filePath),
        alt: typeof node.alt === "string" ? node.alt : "",
        ...(typeof title === "string" ? { title } : {}),
      };
    }
    case "mdxJsxTextElement": {
      if (typeof node.name !== "string") {
        unsupported(
          node as NodeWithPosition,
          filePath,
          "Fragments are not supported inline.",
        );
      }
      const name = node.name as string;
      const component: InlineComponent = {
        _tag: "InlineComponent",
        name,
        attributes: attributesFromMdx(node as never, filePath),
        content: (
          node.children as Array<PhrasingContent | Record<string, unknown>>
        ).map((child) => normalizeInline(child, filePath)),
      };
      return component;
    }
    case "mdxTextExpression":
      return unsupported(
        node as NodeWithPosition,
        filePath,
        "JavaScript expressions are not serializable. Use a registered Foldkit component.",
      );
    default:
      return unsupported(node as NodeWithPosition, filePath);
  }
};

const normalizeTable = (node: MdastTable, filePath?: string): Table => {
  const rows: TableRow[] = node.children.map((row) => ({
    _tag: "TableRow",
    cells: row.children.map((cell) => ({
      _tag: "TableCell",
      content: cell.children.map((child) => normalizeInline(child, filePath)),
    })),
  }));
  const header = rows[0];
  if (header === undefined) {
    return unsupported(node, filePath, "A table must contain a header row.");
  }
  return {
    _tag: "Table",
    alignments: (node.align ?? []).map((alignment) => alignment ?? "none"),
    header,
    rows: rows.slice(1),
  };
};

const normalizeListItem = async (
  node: MdastListItem,
  slugger: GithubSlugger,
  options: CompileOptions,
): Promise<import("./ast.js").ListItem> => ({
  _tag: "ListItem",
  blocks: await Promise.all(
    node.children.map((child) => normalizeBlock(child, slugger, options)),
  ),
  ...(typeof node.checked === "boolean" ? { checked: node.checked } : {}),
});

const withCodeLineNumbers = (highlightedHtml: string): string => {
  let line = 0;
  const numbered = highlightedHtml.replace(
    /<span class="line">/gu,
    () => `<span class="line" data-line="${String(++line)}">`,
  );
  const digits = Math.max(2, String(Math.max(1, line)).length);
  return numbered.replace("<pre ", `<pre data-line-digits="${digits}" `);
};

const normalizeBlock = async (
  node: RootContent | MdastBlockContent | Record<string, unknown>,
  slugger: GithubSlugger,
  options: CompileOptions,
): Promise<Block> => {
  const filePath = options.filePath;
  switch (node.type) {
    case "heading": {
      const content = (node.children as PhrasingContent[]).map((child) =>
        normalizeInline(child, filePath),
      );
      return {
        _tag: "Heading",
        id: slugger.slug(inlineText(content)),
        level: Number(node.depth),
        content,
      };
    }
    case "paragraph":
      return {
        _tag: "Paragraph",
        content: (node.children as PhrasingContent[]).map((child) =>
          normalizeInline(child, filePath),
        ),
      };
    case "code": {
      const value = String(node.value);
      const language = typeof node.lang === "string" ? node.lang : undefined;
      let highlightedHtml: string | undefined;
      if (options.highlight !== false) {
        try {
          highlightedHtml = withCodeLineNumbers(
            await codeToHtml(value, {
              lang: language ?? "text",
              themes: { light: "github-light", dark: "github-dark" },
              defaultColor: false,
            }),
          );
        } catch {
          highlightedHtml = undefined;
        }
      }
      return {
        _tag: "CodeBlock",
        value,
        ...(language === undefined ? {} : { language }),
        ...(typeof node.meta === "string" ? { meta: node.meta } : {}),
        ...(highlightedHtml === undefined ? {} : { highlightedHtml }),
      };
    }
    case "list":
      return {
        _tag: "List",
        ordered: node.ordered === true,
        ...(typeof node.start === "number" ? { start: node.start } : {}),
        items: await Promise.all(
          (node.children as MdastListItem[]).map((child) =>
            normalizeListItem(child, slugger, options),
          ),
        ),
      };
    case "blockquote":
      return {
        _tag: "Blockquote",
        blocks: await Promise.all(
          (node.children as MdastBlockContent[]).map((child) =>
            normalizeBlock(child, slugger, options),
          ),
        ),
      };
    case "thematicBreak":
      return { _tag: "ThematicBreak" };
    case "table":
      return normalizeTable(node as unknown as MdastTable, filePath);
    case "leafDirective":
    case "containerDirective": {
      const component: BlockComponent = {
        _tag: "BlockComponent",
        name: String(node.name),
        attributes: attributesFromDirective(node.attributes as never),
        blocks:
          node.type === "leafDirective"
            ? []
            : await Promise.all(
                (node.children as MdastBlockContent[]).map((child) =>
                  normalizeBlock(child, slugger, options),
                ),
              ),
      };
      return component;
    }
    case "mdxJsxFlowElement": {
      if (typeof node.name !== "string") {
        return unsupported(
          node as NodeWithPosition,
          filePath,
          "Fragments are not supported.",
        );
      }
      return {
        _tag: "BlockComponent",
        name: node.name,
        attributes: attributesFromMdx(node as never, filePath),
        blocks: await Promise.all(
          (
            node.children as Array<MdastBlockContent | Record<string, unknown>>
          ).map((child) => normalizeBlock(child, slugger, options)),
        ),
      };
    }
    case "mdxFlowExpression":
    case "mdxjsEsm":
      return unsupported(
        node as NodeWithPosition,
        filePath,
        "Effectdocs MDX is deterministic: register a Foldkit component instead of executing module code.",
      );
    case "html":
      return unsupported(
        node as NodeWithPosition,
        filePath,
        "Raw HTML is disabled. Use an MDX component so output remains typed and auditable.",
      );
    default:
      return unsupported(node as NodeWithPosition, filePath);
  }
};

const blockText = (block: Block): string => {
  switch (block._tag) {
    case "Heading":
    case "Paragraph":
      return inlineText(block.content);
    case "CodeBlock":
      return block.value;
    case "List":
      return block.items
        .flatMap((item) => item.blocks.map(blockText))
        .join(" ");
    case "Blockquote":
    case "BlockComponent":
      return block.blocks.map(blockText).join(" ");
    case "Table":
      return [block.header, ...block.rows]
        .flatMap((row) => row.cells.map((cell) => inlineText(cell.content)))
        .join(" ");
    case "ThematicBreak":
      return "";
  }
};

const frontmatterFromRoot = (
  root: Root,
  filePath?: string,
): Readonly<Record<string, unknown>> => {
  const yaml = root.children.find((node) => node.type === "yaml") as
    { type: "yaml"; value: string } | undefined;
  if (yaml === undefined) return {};
  const parsed = parseYaml(yaml.value);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Frontmatter must be a YAML object${location(yaml, filePath)}.`,
    );
  }
  return parsed as Record<string, unknown>;
};

const resolveFrontmatter = (
  raw: Readonly<Record<string, unknown>>,
  blocks: ReadonlyArray<Block>,
  filePath?: string,
): PageFrontmatterType => {
  const firstHeading = blocks.find((block) => block._tag === "Heading");
  const title =
    typeof raw.title === "string"
      ? raw.title
      : firstHeading?._tag === "Heading"
        ? inlineText(firstHeading.content)
        : undefined;
  if (title === undefined || title.trim().length === 0) {
    throw new Error(
      `Document${filePath === undefined ? "" : ` ${filePath}`} needs a frontmatter title or heading.`,
    );
  }
  return decodePageFrontmatter({ ...raw, title });
};

export const compile = async (
  source: string,
  options: CompileOptions = {},
): Promise<CompiledPage> => {
  const root = processor.parse(source) as Root;
  const slugger = new GithubSlugger();
  const contentNodes = root.children.filter((node) => node.type !== "yaml");
  const blocks = await Promise.all(
    contentNodes.map((node) => normalizeBlock(node, slugger, options)),
  );
  const frontmatter = resolveFrontmatter(
    frontmatterFromRoot(root, options.filePath),
    blocks,
    options.filePath,
  );
  const toc: TocItemType[] = blocks
    .filter(
      (block): block is Extract<Block, { _tag: "Heading" }> =>
        block._tag === "Heading" && block.level >= 2 && block.level <= 4,
    )
    .map((heading) => ({
      id: heading.id,
      title: inlineText(heading.content),
      depth: heading.level,
    }));
  return {
    frontmatter,
    document: { blocks },
    toc,
    source,
    plainText: [
      frontmatter.title,
      frontmatter.description ?? "",
      ...blocks.map(blockText),
    ]
      .filter(Boolean)
      .join("\n"),
  };
};

export const decodeCompiledPage = S.decodeUnknownSync(CompiledPage);
