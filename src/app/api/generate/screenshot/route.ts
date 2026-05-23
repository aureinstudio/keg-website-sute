import { NextRequest, NextResponse } from 'next/server'
import { htmlToScreenshot } from '@/lib/generation-engine/screenshot'
import { createServiceClient } from '@/lib/supabase/client'

export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { pageId } = await req.json() as { pageId: string }

    const supabase = createServiceClient()
    const { data: page, error } = await supabase
      .from('pages')
      .select('html_content, project_id')
      .eq('id', pageId)
      .single()

    if (error || !page?.html_content) {
      return NextResponse.json({ error: 'Page not found or HTML not generated yet' }, { status: 404 })
    }

    const filename = `${page.project_id}-${pageId}-${Date.now()}`
    const screenshotUrl = await htmlToScreenshot(page.html_content, filename)

    await supabase
      .from('pages')
      .update({ screenshot_url: screenshotUrl })
      .eq('id', pageId)

    return NextResponse.json({ screenshotUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[generate/screenshot]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
