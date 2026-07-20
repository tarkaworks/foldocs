import { defineConfig } from "effectdocs";

export default defineConfig({
  site: {
    title: "Effectdocs",
    description: "Production documentation powered by Effect and Foldkit.",
    baseUrl: "https://example.com",
    logoText: "Effectdocs",
    badge: "Beta",
    tagline:
      "Beautiful, searchable, LLM-ready documentation powered by Effect and Foldkit.",
    githubUrl: "https://github.com/Aniket-508/effectdocs",
    npmUrl: "https://www.npmjs.com/package/effectdocs",
    keywords: ["Effect", "Foldkit", "documentation"],
    favicon: "/favicon.svg",
    locale: "en",
  },
  basePath: "/docs",
  content: { dir: "content/docs" },
  llms: true,
  markdown: true,
  sitemap: true,
});
