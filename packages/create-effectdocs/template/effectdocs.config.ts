import { defineConfig } from "effectdocs";

export default defineConfig({
  site: {
    title: "Effectdocs",
    description: "Production documentation powered by Effect and Foldkit.",
    baseUrl: "https://example.com",
    logoText: "Effectdocs",
    githubUrl: "https://github.com/your-org/your-repo",
  },
  basePath: "/docs",
  content: { dir: "content/docs" },
  llms: true,
  sitemap: true,
});
