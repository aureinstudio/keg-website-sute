'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'

interface Template {
  id: string
  name: string
  thumbnail_url: string | null
  keywords: string[]
}

interface Props {
  value: string
  onChange: (id: string) => void
}

export function TemplateSelector({ value, onChange }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg overflow-hidden animate-pulse">
            <div className="h-40 bg-gray-200" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!templates.length) {
    return (
      <p className="text-center text-gray-500 py-12">
        아직 등록된 템플릿이 없습니다.{' '}
        <a href="/admin/templates/new" className="text-blue-600 underline">
          관리자 페이지에서 추가하세요.
        </a>
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`text-left border rounded-lg overflow-hidden transition-all ${
            value === t.id
              ? 'ring-2 ring-blue-500 border-blue-500'
              : 'hover:shadow-md hover:border-gray-300'
          }`}
        >
          <div className="relative h-40 bg-gray-100">
            {t.thumbnail_url ? (
              <Image
                src={t.thumbnail_url}
                alt={t.name}
                fill
                className="object-cover object-top"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                미리보기 없음
              </div>
            )}
          </div>
          <div className="p-3 space-y-1 bg-white">
            <p className="font-medium text-sm">{t.name}</p>
            <div className="flex flex-wrap gap-1">
              {t.keywords.slice(0, 3).map((kw) => (
                <span
                  key={kw}
                  className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
