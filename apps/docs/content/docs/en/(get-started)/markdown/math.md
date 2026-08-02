---
title: Math
description: Write inline and display equations with built-in KaTeX rendering.
tags:
  - Markdown
  - math
---

# Math

Foldocs supports mathematical notation without additional packages or compiler
configuration. The MDX pipeline recognizes math syntax, renders it with KaTeX,
and keeps accessible MathML in the generated static HTML.

## Inline equations

Wrap an inline expression in single dollar signs:

```md
Einstein's relation is $E = mc^2$.
```

Inline math stays within the surrounding paragraph and participates in normal
line wrapping.

## Display equations

Use double dollar signs for a standalone equation:

```md
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$
```

The result is centered and scrolls horizontally when a long expression cannot
fit on a narrow viewport.

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

## Math fences

A fenced `math` block is useful for long expressions that should remain easy to
copy from the source document.

````md
```math
c = \pm\sqrt{a^2 + b^2}
```
````

```math
c = \pm\sqrt{a^2 + b^2}
```

## Static and accessible output

KaTeX rendering happens during compilation. Readers receive the equation in the
prerendered route instead of waiting for client JavaScript, and assistive
technology can use the embedded MathML representation.
