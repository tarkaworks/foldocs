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
`socialImage` en el frontmatter. Antes de que Foldkit tome el control, la entrada
generada precarga solamente el módulo de la página actual e inicializa el runtime
con esa página, por lo que una recarga no muestra brevemente la vista de carga. Usa
`prerender: false` únicamente si el despliegue necesita una sola entrada SPA.

La búsqueda local usa un `search-index.json` por idioma que se descarga solo al
buscar. Define `search.staticIndex: false` para incluir el contenido en el
manifiesto JavaScript.

## Navegación y versiones

Usa entradas como `"---Introducción---"` en `meta.json` para encabezados
estáticos. Las carpetas hijas se convierten en secciones desplegables y su propio
`meta.json` controla `title`, `pages` y `defaultOpen`. Usa `"root": true` y una
`description` opcional para convertir una carpeta en una pestaña del layout.
Solo las páginas de la raíz activa aparecen en la barra lateral y la paginación.
Las carpetas `v1` y `v2` permiten versionado parcial; los grupos `(guides)` y
`(api)` aíslan secciones sin cambiar sus URLs.

## Componentes MDX personalizados

Registra renderizadores Foldkit en `src/mdx-components.ts` y pasa
`components: mdxComponents` a `createDocsProgram`. Los nombres registrados se
pueden usar directamente desde archivos MDX, por ejemplo
`<Kbd>⌘K</Kbd>` o `<Aside type="tip">…</Aside>`.
