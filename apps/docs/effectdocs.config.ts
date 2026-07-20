import { defineConfig } from "effectdocs";

export default defineConfig({
  site: {
    title: "Effectdocs",
    description: "An Effect-native documentation framework for Foldkit.",
    baseUrl: "https://effectdocs.dev",
    logoText: "Effectdocs",
    githubUrl: "https://github.com/effectdocs/effectdocs",
  },
  basePath: "/docs",
  content: { dir: "content/docs" },
  llms: true,
  sitemap: true,
});
