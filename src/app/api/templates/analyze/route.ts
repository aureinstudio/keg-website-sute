import { NextRequest, NextResponse } from 'next/server'
import { crawlUrl, crawlHtml } from '@/lib/style-engine/crawler'
import { analyzeStyle } from '@/lib/style-engine/analyzer'
import { saveTemplate } from '@/lib/style-engine/vector-store'

export const maxDuration = 120
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, html: rawHtml, name } = body as {
      url?: string
      html?: string
      name: string
    }

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!url && !rawHtml) {
      return NextResponse.json({ error: 'url or html is required' }, { status: 400 })
    }

    const { html, css, screenshotUrl } = url
      ? await crawlUrl(url)
      : await crawlHtml(rawHtml!)

    const profile = await analyzeStyle(html, css)
    const templateId = await saveTemplate(name, profile, screenshotUrl)

    return NextResponse.json({ templateId, thumbnailUrl: screenshotUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[analyze]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
