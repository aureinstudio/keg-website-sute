import { createServiceClient } from '@/lib/supabase/client'
import { createEmbedding } from '@/lib/openai'
import type { StyleProfile } from '@/lib/types'

export interface TemplateMatch {
  id: string
  name: string
  thumbnailUrl: string
  cssSnippets: StyleProfile['cssSnippets']
  keywords: string[]
  similarity: number
}

function profileToEmbeddingText(profile: StyleProfile): string {
  return [
    `colors: ${Object.values(profile.colors).join(' ')}`,
    `fonts: ${profile.fonts.heading} ${profile.fonts.body}`,
    `layout: container ${profile.layout.containerWidth} padding ${profile.layout.sectionPadding}`,
    `style: ${profile.keywords.join(', ')}`,
  ].join('. ')
}

export async function saveTemplate(
  name: string,
  profile: StyleProfile,
  thumbnailUrl: string
): Promise<string> {
  const embeddingText = profileToEmbeddingText(profile)
  const embedding = await createEmbedding(embeddingText)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('templates')
    .insert({
      name,
      thumbnail_url: thumbnailUrl,
      colors: profile.colors,
      fonts: profile.fonts,
      layout: profile.layout,
      css_snippets: profile.cssSnippets,
      keywords: profile.keywords,
      embedding,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save template: ${error.message}`)
  return data.id
}

export async function searchSimilarTemplates(
  query: string,
  matchCount = 3
): Promise<TemplateMatch[]> {
  const embedding = await createEmbedding(query)
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('match_templates', {
    query_embedding: embedding,
    match_count: matchCount,
  })

  if (error) throw new Error(`Vector search failed: ${error.message}`)

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    thumbnailUrl: row.thumbnail_url ?? '',
    cssSnippets: row.css_snippets,
    keywords: row.keywords,
    similarity: row.similarity,
  }))
}
