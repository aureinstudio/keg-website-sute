import { createServiceClient } from '@/lib/supabase/client'

export class CrawlError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'CrawlError'
  }
}

export interface CrawlResult {
  html: string
  css: string
  screenshotUrl: string
}

export async function crawlUrl(url: string): Promise<CrawlResult> {
  if (!URL.canParse(url)) throw new CrawlError(`Invalid URL: ${url}`)

  const token = process.env.BROWSERLESS_API_KEY
  const baseUrl = process.env.BROWSERLESS_URL

  const [screenshotRes, contentRes] = await Promise.all([
    fetch(`${baseUrl}/screenshot?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        options: { type: 'png', fullPage: true },
        viewport: { width: 1920, height: 1080 },
      }),
    }),
    fetch(`${baseUrl}/content?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  ])

  if (!screenshotRes.ok) {
    throw new CrawlError(`Screenshot failed: ${screenshotRes.status} ${screenshotRes.statusText}`)
  }
  if (!contentRes.ok) {
    throw new CrawlError(`Content fetch failed: ${contentRes.status} ${contentRes.statusText}`)
  }

  const [screenshotBuffer, html] = await Promise.all([
    screenshotRes.arrayBuffer(),
    contentRes.text(),
  ])

  const css = extractCss(html)
  const screenshotUrl = await uploadScreenshot(screenshotBuffer, new URL(url).hostname)

  return { html, css, screenshotUrl }
}

export async function crawlHtml(html: string): Promise<CrawlResult> {
  const css = extractCss(html)
  return { html, css, screenshotUrl: '' }
}

function extractCss(html: string): string {
  const styleTagMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? []
  return styleTagMatches
    .map((s) => s.replace(/<\/?style[^>]*>/gi, ''))
    .join('\n')
}

async function uploadScreenshot(buffer: ArrayBuffer, label: string): Promise<string> {
  const supabase = createServiceClient()
  const filename = `templates/${Date.now()}-${label}.png`

  const { error } = await supabase.storage
    .from('screenshots')
    .upload(filename, buffer, { contentType: 'image/png', upsert: true })

  if (error) throw new CrawlError('Storage upload failed', error)

  const { data: { publicUrl } } = supabase.storage
    .from('screenshots')
    .getPublicUrl(filename)

  return publicUrl
}
