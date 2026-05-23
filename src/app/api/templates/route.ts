import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/client'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, thumbnail_url, keywords, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
