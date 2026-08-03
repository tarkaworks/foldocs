---
title: Configuración
description: Personaliza Foldocs desde un único archivo de configuración tipado.
order: 3
---

# Configuración

Edita `foldocs.config.ts` para cambiar la identidad del sitio y las rutas de
contenido.

:::Aside{type="tip"}
Esta página `.md` se analiza con `@foldkit/markdown`. La directiva `Aside` se
valida mediante `src/markdown-islands.ts` durante el desarrollo y las
compilaciones.
:::

## Metadatos del sitio

Establece `site.baseUrl` en el origen de producción para que las URL canónicas,
las URL de imágenes sociales y el `sitemap.xml` generado sean correctos.
`description`, `keywords`, `favicon`, `socialImage` y `locale` proporcionan los
metadatos predeterminados del documento sin editar `index.html`.

Cada página puede sobrescribir `description`, `keywords` y `socialImage` en su
frontmatter. Foldocs mantiene esos valores sincronizados durante la navegación
del cliente y los emite directamente en el HTML de producción de esa ruta.

`logoText`, `badge` y `tagline` personalizan la página de inicio y la interfaz de
documentación integradas con el estilo de Foldkit. Añade `githubUrl`,
`discordUrl`, `xUrl` o `npmUrl` para mostrar los enlaces correspondientes en el
encabezado y la navegación móvil. Con i18n y el `basePath: "/docs"`
predeterminado, `/` redirige a una página de inicio de idioma como `/es`;
establecer `basePath: "/"` convierte el documento Markdown raíz de cada idioma
en su página de inicio.

Establece `landing.footer.author`, `authorUrl`, `copyright` y `twitterUrl` para
usar el mismo pie de atribución en la página de inicio y en todas las páginas de
documentación. La frase sobre el código fuente enlaza a `site.githubUrl`.

## Internacionalización

Configura `i18n.defaultLocale`, `i18n.fallbackLocale` e `i18n.locales`. El
contenido de cada idioma vive en `content/docs/<locale>` y se publica mediante
`/<locale>/docs`. Cada idioma puede proporcionar `dir: "rtl"` y cadenas `ui`
parciales; las cadenas no especificadas heredan los valores predeterminados en
inglés.

Si falta un documento traducido, Foldocs sirve el contenido del idioma de
respaldo en la URL del idioma solicitado. La navegación, la búsqueda, la salida
Markdown, los archivos LLM, las URL canónicas y las alternativas del sitemap
continúan usando el idioma solicitado.

## Salidas legibles por IA

Foldocs emite `llms.txt`, un índice compacto de páginas, y `llms-full.txt`, un
corpus Markdown completo. Establece `llms: false` solo si no quieres generar
estos recursos.

Cada página también se emite como Markdown procesado añadiendo `.md` a su URL;
por ejemplo, `/es/docs/concepts/effects.md`. Foldocs sirve el mismo contenido
cuando un cliente solicita la ruta HTML con `Accept: text/markdown`. Establece
`markdown: false` para desactivar los recursos por página y sus acciones.

Las compilaciones de producción prerenderizan de forma predeterminada cada ruta
de inicio y documentación en un directorio `index.html`. El HTML generado
contiene el layout completo de Foldkit y el contenido de la página, por lo que
sigue siendo legible sin JavaScript. Antes de que Foldkit tome el control, el
punto de entrada generado precarga solo el módulo de la página actual e
inicializa el runtime desde esa página. Así, al recargar se mantiene el documento
terminado en pantalla en lugar de mostrar brevemente una vista de carga.
Establece `prerender: false` solo para despliegues que requieran una única entrada
SPA.

Los documentos de búsqueda local se emiten en un `search-index.json` por idioma
y se descargan solo cuando alguien busca, manteniendo el corpus completo fuera
del bundle JavaScript inicial. Establece `search.staticIndex: false` para incluir
el contenido de búsqueda en el manifiesto virtual.

## Frontmatter

Usa `order`, `label`, `icon`, `index`, `hidden`, `draft`, `tags`, `keywords` y
`socialImage` para controlar los metadatos de la página. Establece `index: true`
en la página índice de una carpeta para enlazar su fila desplegable. `icon`
acepta nombres integrados de Lucide, incluidos `book-open`, `file-text`,
`package`, `rocket`, `settings` y `sparkles`.

## Estructura de la barra lateral

Usa entradas separadoras en `meta.json` para los encabezados de grupos
estáticos. Las carpetas hijas se convierten en secciones desplegables y usan sus
propios metadatos:

```json
{
  "pages": [
    "---Introducción---",
    "index",
    "manual-installation",
    "---Escritura---",
    "configuration"
  ]
}
```

`manual-installation/meta.json` define su menú desplegable:

```json
{
  "title": "Instalación manual",
  "icon": "package",
  "pages": ["pnpm", "npm"],
  "defaultOpen": false
}
```

Las páginas pueden establecer el mismo icono en el frontmatter:

```yaml
---
title: Desplegar
icon: rocket
---
```

Para sustituir un nombre integrado o añadir un icono del proyecto, registra
marcado SVG de confianza en `site.icons`. El mismo nombre funcionará en el
frontmatter de las páginas y en `meta.json`:

```ts
export default defineConfig({
  site: {
    title: 'Mis docs',
    icons: {
      rocket: '<svg viewBox="0 0 24 24" aria-hidden="true">...</svg>',
    },
  },
})
```

Los directorios entre paréntesis son grupos de rutas. Por ejemplo,
`content/docs/es/(get-started)/installation.mdx` se agrupa bajo «Primeros pasos»
en la barra lateral, pero sigue resolviendo a `/es/docs/installation`, siguiendo
la convención de contenido de Fumadocs.

Establece `"root": true` y añade una `description` opcional para convertir una
carpeta en una pestaña del layout. Solo las páginas de la raíz activa aparecen
en la barra lateral y la paginación. Usa carpetas normales como `v1` y `v2` para
versionado parcial, o grupos de rutas como `(guides)` y `(api)` para secciones
aisladas sin segmentos adicionales en la URL.

## Islas de Markdown y MDX determinista

Las páginas `.md` usan el analizador oficial `@foldkit/markdown`. Define los
esquemas de atributos de las directivas en `src/markdown-islands.ts`, pásalos
mediante `markdownOptions.islands` y relaciónalos con vistas usando el helper
oficial `islandsFor`. La entrada generada pasa esas vistas a
`createDocsProgram({ islands })`. Esto mantiene el Markdown estándar tipado desde
la compilación hasta el renderizado, mientras Foldocs añade frontmatter, enlaces
de encabezados, resaltado de sintaxis, navegación y texto de búsqueda.

Usa `.mdx` solo cuando una página necesite sintaxis de componentes similar a JSX
en línea. Foldocs MDX acepta componentes registrados con atributos de cadena
literales; nunca ejecuta expresiones JavaScript ni código de módulos.

Registra renderizadores presentacionales de Foldkit en `src/mdx-components.ts` y
pasa el registro a `createDocsProgram`. Los atributos de los componentes son
cadenas literales y sus hijos ya son nodos de Foldkit renderizados, manteniendo
el contenido determinista y seguro para indexar.

```ts
import { html } from 'foldkit/html'
import type { MdxComponents } from 'foldocs'

const h = html()

export const mdxComponents: MdxComponents = {
  inline: {
    Kbd: (_, content) => h.kbd([], content),
  },
  block: {
    Aside: (_, content) => h.aside([], content),
  },
}
```

Usa los nombres registrados directamente desde MDX:

```mdx
Pulsa <Kbd>⌘K</Kbd> para buscar.

<Aside type="tip">Este renderizador pertenece a tu aplicación.</Aside>
```
