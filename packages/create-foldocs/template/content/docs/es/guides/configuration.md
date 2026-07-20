---
title: Configuración
description: Personaliza Foldocs desde un único archivo de configuración tipado.
order: 3
---

# Configuración

Edita `foldocs.config.ts` para cambiar la identidad del sitio, las rutas de
contenido y los idiomas.

## Internacionalización

Define `i18n.defaultLocale`, `i18n.fallbackLocale` y `i18n.locales`. Cada idioma
vive en `content/docs/<locale>` y se publica bajo `/<locale>/docs`. Puedes
traducir las etiquetas de la interfaz con `locales[].ui`.

Si una página no existe en el idioma solicitado, Foldocs usa el documento del
idioma de respaldo manteniendo la URL del idioma seleccionado.

## Salidas para IA y SEO

Cada idioma recibe rutas Markdown, `/<locale>/llms.txt` y
`/<locale>/llms-full.txt`. El sitemap incluye todas las rutas y enlaces alternos
`hreflang`, además de `x-default`.

Las compilaciones de producción prerenderizan cada ruta con todo el contenido y
metadatos específicos de la página. Puedes definir `description`, `keywords` y
`socialImage` en el frontmatter. Usa `prerender: false` únicamente si el despliegue
necesita una sola entrada SPA.

La búsqueda local usa un `search-index.json` por idioma que se descarga solo al
buscar. Define `search.staticIndex: false` para incluir el contenido en el
manifiesto JavaScript.

## Navegación y versiones

Los archivos `meta.json` controlan el título, el orden y el estado inicial de
cada grupo. Usa `"root": true` y una `description` opcional para convertir una
carpeta en una pestaña del layout. Solo las páginas de la raíz activa aparecen
en la barra lateral y la paginación. Las carpetas `v1` y `v2` permiten versionado
parcial; los grupos `(guides)` y `(api)` aíslan secciones sin cambiar sus URLs.

## Componentes MDX personalizados

Registra renderizadores Foldkit en `src/mdx-components.ts` y pasa
`components: mdxComponents` a `createDocsProgram`. Los nombres registrados se
pueden usar directamente desde archivos MDX, por ejemplo
`<Kbd>⌘K</Kbd>` o `<Aside type="tip">…</Aside>`.

## OpenAPI

Edita el archivo `openapi.yaml` incluido y ejecuta `pnpm generate:api`. El paquete
separado `@foldocs/openapi` genera una raíz de referencia API en
`content/docs/en/api`, con operaciones, parámetros, esquemas, ejemplos, muestras
de peticiones, respuestas y navegación.

## AsyncAPI

Edita `asyncapi.yaml` y ejecuta `pnpm generate:events`. `@foldocs/asyncapi` genera
páginas de canales y mensajes con payloads, ejemplos, bindings y navegación.

## EPUB y Obsidian

Ejecuta `pnpm export:epub` para crear un EPUB 3. Para migrar una bóveda de
Obsidian, crea la carpeta `vault` y ejecuta `pnpm import:obsidian`; los enlaces
wiki, embeds, comentarios y adjuntos se convierten en MDX administrado.
