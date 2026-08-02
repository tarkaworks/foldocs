import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'

const baseUrl = (
  process.env.FOLDOCS_PDF_BASE_URL ?? 'http://localhost:4173'
).replace(/\/+$/u, '')
const outputDirectory = path.resolve(process.env.FOLDOCS_PDF_OUTPUT ?? 'pdfs')
const requestedRoutes = process.argv.slice(2)

const sitemapRoutes = async () => {
  const response = await fetch(`${baseUrl}/sitemap.xml`)
  if (!response.ok)
    throw new Error(
      `Unable to read ${baseUrl}/sitemap.xml (${String(response.status)}). Pass routes after docs:pdf or configure site.baseUrl and rebuild.`,
    )
  const xml = await response.text()
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/gu)].map(([, value]) => {
    const url = new URL(value)
    return `${url.pathname}${url.search}`
  })
}

const routes =
  requestedRoutes.length > 0 ? requestedRoutes : await sitemapRoutes()
if (routes.length === 0) throw new Error('No documentation routes were found.')

await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  for (const route of routes) {
    const url = new URL(route, `${baseUrl}/`)
    await page.goto(url.toString(), { waitUntil: 'networkidle' })
    await page.emulateMedia({ media: 'print' })
    const name =
      url.pathname
        .replace(/^\/+|\/+$/gu, '')
        .replace(/[^a-z0-9._-]+/giu, '-') || 'index'
    await page.pdf({
      path: path.join(outputDirectory, `${name}.pdf`),
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
    })
  }
} finally {
  await browser.close()
}

console.log(
  `Exported ${String(routes.length)} PDF file(s) to ${outputDirectory}.`,
)
