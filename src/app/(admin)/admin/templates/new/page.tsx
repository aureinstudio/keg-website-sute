'use client'
import { useRouter } from 'next/navigation'
import { TemplateUploader } from '@/components/admin/TemplateUploader'
import Link from 'next/link'

export default function NewTemplatePage() {
  const router = useRouter()

  return (
    <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
      <div>
        <Link
          href="/admin/templates"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← 목록으로
        </Link>
        <h1 className="text-2xl font-bold mt-2">새 템플릿 추가</h1>
        <p className="text-gray-500 text-sm mt-1">
          분석할 사이트 URL을 입력하세요. AI가 디자인 스타일을 자동으로 추출합니다.
          <br />
          <span className="text-gray-400">분석에는 1~2분 정도 소요됩니다.</span>
        </p>
      </div>

      <TemplateUploader onSuccess={() => router.push('/admin/templates')} />
    </div>
  )
}
