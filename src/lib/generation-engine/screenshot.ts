import { createServiceClient } from '@/lib/supabase/client'

export class ScreenshotError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'ScreenshotError'
  }
}

export async function htmlToScreenshot(html: string, filename: string): Promise<string> {
  const token = process.env.BROWSERLESS_API_KEY
  const baseUrl = process.env.BROWSERLESS_URL

  const res = await fetch(`${baseUrl}/screenshot?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      options: { type: 'png', fullPage: true },
      viewport: { width: 1920, height: 1080 },
    }),
  })

  if (!res.ok) {
    throw new ScreenshotError(
      `Browserless screenshot failed: ${res.status} ${res.statusText}`
    )
  }

  const buffer = await res.arrayBuffer()

  const supabase = createServiceClient()
  const path = `pages/${filename}.png`

  const { error } = await supabase.storage
    .from('screenshots')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })

  if (error) throw new ScreenshotError('Supabase storage upload failed', error)

  const { data: { publicUrl } } = supabase.storage
    .from('screenshots')
    .getPublicUrl(path)

  return publicUrl
}
