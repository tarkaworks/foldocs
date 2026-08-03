import type { OgImageTemplate, OgImageTemplateContext } from 'foldocs-core'
import { foldocsLogoSvg } from 'foldocs-ui'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'

const colors = {
  background: '#1c1a20',
  foreground: '#f7f5f8',
  muted: '#aaa4b2',
  primary: '#9bd32e',
} as const

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const truncate = (value: string, length: number): string => {
  const normalized = value.replace(/\s+/gu, ' ').trim()
  if (normalized.length <= length) return normalized
  const prefix = normalized.slice(0, length - 1)
  const boundary = prefix.lastIndexOf(' ')
  return `${prefix.slice(0, Math.max(boundary, length - 24)).trimEnd()}…`
}

const titleSize = (title: string): number => {
  if (title.length <= 18) return 56
  if (title.length <= 32) return 52
  if (title.length <= 48) return 46
  return 42
}

const monochromeLogo = (
  source: string,
  size: number,
  fill: string,
  style = '',
): string => {
  const svg = source
    .replace(/<\?xml[^>]*>/giu, '')
    .replace(/\sfill=(?:"[^"]*"|'[^']*')/giu, '')
    .replace(/\s(?:width|height|style)=(?:"[^"]*"|'[^']*')/giu, '')
  return svg.replace(
    /<svg\b/iu,
    `<svg width="${String(size)}" height="${String(size)}" fill="${fill}" style="display:block;${style}"`,
  )
}

/** The branded Foldocs card used when no project-specific template is supplied. */
export const defaultOgImageTemplate: OgImageTemplate = context => {
  const title = escapeHtml(truncate(context.title, 92))
  const description =
    context.description === undefined
      ? undefined
      : escapeHtml(truncate(context.description, 170))
  const logo = monochromeLogo(context.logoSvg, 600, colors.primary)

  return `<div style="width:100%;height:100%;display:flex;position:relative;overflow:hidden;background:${colors.background};color:${colors.foreground};font-family:Inter,sans-serif;">
  <div style="position:absolute;right:-74px;bottom:-150px;display:flex;">${logo}</div>
  <div style="position:absolute;left:66px;top:82px;display:flex;flex-direction:column;width:700px;">
    <div style="font-size:${String(titleSize(context.title))}px;font-weight:700;letter-spacing:-0.045em;line-height:1.02;">${title}</div>
    ${description === undefined ? '' : `<div style="color:${colors.muted};font-size:31px;font-weight:500;letter-spacing:-0.025em;line-height:1.24;margin-top:28px;width:680px;">${description}</div>`}
  </div>
  <div style="position:absolute;left:66px;bottom:52px;color:${colors.muted};font-size:19px;font-weight:600;letter-spacing:-0.01em;">Made by Tarkaworks</div>
</div>`
}

type TakumiRenderer = import('takumi-js/node').Renderer

const rendererPromise: Promise<TakumiRenderer> = (async () => {
  const [{ Renderer }, font] = await Promise.all([
    import('takumi-js/node'),
    fs.readFile(
      fileURLToPath(
        import.meta
          .resolve('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),
      ),
    ),
  ])
  const renderer = new Renderer()
  await renderer.registerFont({
    data: font,
    name: 'Inter',
    generic: 'sans-serif',
  })
  return renderer
})()

/** Renders a configured Foldocs OG template directly to PNG bytes with Takumi. */
export const renderOgImage = async (
  context: Omit<OgImageTemplateContext, 'logoSvg'> & {
    readonly logoSvg?: string
  },
  template: OgImageTemplate = defaultOgImageTemplate,
): Promise<Uint8Array> => {
  const [{ render }, renderer] = await Promise.all([
    import('takumi-js'),
    rendererPromise,
  ])
  const html = await template({
    ...context,
    logoSvg: context.logoSvg ?? foldocsLogoSvg,
  })
  const image = await render(html, {
    renderer,
    width: context.width,
    height: context.height,
    format: 'png',
    emoji: 'from-font',
    fontFamilies: ['Inter'],
    lang: context.locale,
  })
  return new Uint8Array(image)
}
