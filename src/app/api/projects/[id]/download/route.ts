import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/client'
import JSZip from 'jszip'

function pageNameToFilename(name: string, order: number): string {
  if (order === 0) return 'index.html'
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-가-힣]/g, '')
  return `${slug}.html`
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: pages, error } = await supabase
    .from('pages')
    .select('page_name, page_order, html_content, status')
    .eq('project_id', id)
    .eq('status', 'approved')
    .order('page_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!pages?.length) {
    return NextResponse.json({ error: 'No approved pages found' }, { status: 404 })
  }

  const zip = new JSZip()
  for (const page of pages) {
    if (!page.html_content) continue
    const filename = pageNameToFilename(page.page_name, page.page_order)
    zip.file(filename, page.html_content)
  }

  const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })

  return new NextResponse(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="website-${id}.zip"`,
    },
  })
}
