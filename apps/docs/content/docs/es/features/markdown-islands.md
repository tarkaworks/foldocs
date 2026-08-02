---
title: Markdown e islas tipadas
description: Usa el flujo oficial de Foldkit Markdown con las mejoras de Foldocs.
order: 3
tags:
  - markdown
  - foldkit
  - islas
---

# Markdown e islas tipadas

Foldocs usa `@foldkit/markdown` como parser y límite de esquemas para cada
página `.md`. Sus nodos CommonMark y GFM forman el documento canónico; después,
Foldocs añade frontmatter, identificadores de encabezado, resaltado de sintaxis,
tabla de contenidos, texto de búsqueda, navegación y salida Markdown estática.

:::Aside{type="tip"}
Este bloque es una isla oficial de Foldkit Markdown. El nombre y el atributo
`type` se validaron durante la compilación antes de usar la vista `Aside` del
proyecto.
:::

Define los atributos con Effect Schema y pásalos al plugin de Vite mediante
`markdownOptions.islands`. Usa `.mdx` solo cuando necesites componentes en línea;
Foldocs mantiene esa ruta determinista y rechaza expresiones JavaScript, módulos,
HTML sin procesar y esquemas de URL inseguros.
