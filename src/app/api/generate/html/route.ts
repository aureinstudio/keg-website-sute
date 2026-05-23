import { NextRequest, NextResponse } from 'next/server'
import { generatePageHtml, extractCssVars } from '@/lib/generation-engine/html-generator'
import { createServiceClient } from '@/lib/supabase/client'
import type { GenerationContext } from '@/lib/types'

export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, pageId, retryFeedback } = body as {
      projectId: string
      pageId: string
      retryFeedback?: string
    }

    const supabase = createServiceClient()

    const [{ data: project }, { data: page }, { data: existingPages }] = await Promise.all([
      supabase
        .from('projects')
        .select('*, templates(*)')
        .eq('id', projectId)
        .single(),
      supabase
        .from('pages')
        .select('*')
        .eq('id', pageId)
        .single(),
      supabase
        .from('pages')
        .select('page_name, html_content')
        .eq('project_id', projectId)
        .eq('status', 'approved')
        .limit(1),
    ])

    if (!project || !page) {
      return NextResponse.json({ error: 'Project or page not found' }, { status: 404 })
    }

    const template = project.templates as any
    const menuItems = (project.menu_structure as any[]).map((m: any) => ({
      id: m.id,
      name: m.name,
      path: m.path,
    }))

    const ctx: GenerationContext = {
      templateId: project.template_id!,
      styleProfile: {
        colors: template.colors,
        fonts: template.fonts,
        layout: template.layout,
        cssSnippets: template.css_snippets,
        keywords: template.keywords,
      },
      menuItems,
      currentPage: page.page_name,
      userPrompt: page.prompt ?? '',
      existingPages: existingPages?.map((p: any) => ({
        name: p.page_name,
        cssVars: extractCssVars(p.html_content ?? ''),
      })),
    }

    await supabase.from('pages').update({ status: 'generating' }).eq('id', pageId)

    const html = await generatePageHtml(ctx, retryFeedback)

    await supabase.from('pages').update({
      html_content: html,
      status: 'generated',
    }).eq('id', pageId)

    return NextResponse.json({ html })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[generate/html]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
