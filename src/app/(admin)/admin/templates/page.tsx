import { createServerSupabaseClient } from '@/lib/supabase/client'
import { TemplateCard } from '@/components/admin/TemplateCard'
import Link from 'next/link'

interface TemplateListItem {
  id: string
  name: string
  thumbnail_url: string | null
  keywords: string[]
  created_at: string
}

export default async function TemplatesPage() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('templates')
    .select('id, name, thumbnail_url, keywords, created_at')
    .order('created_at', { ascending: false })

  const templates = (data ?? []) as TemplateListItem[]

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">스타일 템플릿</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI가 학습한 디자인 스타일 목록입니다
          </p>
        </div>
        <Link
          href="/admin/templates/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + 새 템플릿 추가
        </Link>
      </div>

      {templates.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              id={t.id}
              name={t.name}
              thumbnailUrl={t.thumbnail_url}
              keywords={t.keywords}
              createdAt={t.created_at}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <p className="text-gray-400 mb-4">아직 등록된 템플릿이 없습니다</p>
          <Link
            href="/admin/templates/new"
            className="text-blue-600 text-sm hover:underline"
          >
            첫 번째 템플릿을 추가해보세요 →
          </Link>
        </div>
      )}
    </div>
  )
}
