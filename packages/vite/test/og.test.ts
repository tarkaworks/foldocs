import type { OgImageTemplateContext } from 'foldocs-core'
import { describe, expect, it } from 'vitest'

import { defaultOgImageTemplate, renderOgImage } from '../src/og.js'

const context = {
  kind: 'page',
  site: {
    title: 'Foldocs',
    logoText: 'Foldocs',
    baseUrl: 'https://foldocs.vercel.app',
  },
  title: 'Quick <Start>',
  description: 'Build documentation with Foldkit & Effect.',
  locale: 'en',
  slug: 'quick-start',
  width: 1200,
  height: 630,
} as const

describe('Open Graph image rendering', () => {
  it('builds the branded template from escaped route metadata', async () => {
    const markup = await defaultOgImageTemplate({
      ...context,
      logoSvg: '<svg viewBox="0 0 200 200"><path d="M0 0h1v1z"/></svg>',
    })

    expect(markup).toContain('Quick &lt;Start&gt;')
    expect(markup).toContain('Foldkit &amp; Effect.')
    expect(markup).toContain('Made by TarkaWorks')
    expect(markup).not.toContain('foldocs.vercel.app')
    expect(markup).not.toContain('transform:rotate')
    expect(markup).not.toContain('border:')
    expect(markup).toContain('M0 0h1v1z')
  })

  it('renders deterministic PNG dimensions and supplies the default logo', async () => {
    let received: OgImageTemplateContext | undefined
    const image = await renderOgImage(
      { ...context, width: 600, height: 315 },
      templateContext => {
        received = templateContext
        return `<div style="width:100%;height:100%;display:flex;background:#1c1a20;color:white;font-family:Inter,sans-serif;align-items:center;justify-content:center;font-size:48px;">Foldocs</div>`
      },
    )
    const png = Buffer.from(image)

    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.readUInt32BE(16)).toBe(600)
    expect(png.readUInt32BE(20)).toBe(315)
    expect(received?.logoSvg).toContain('M148.656 50.395')
  })
})
