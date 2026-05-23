import Image from 'next/image'

interface Props {
  id: string
  name: string
  thumbnailUrl: string | null
  keywords: string[]
  createdAt: string
}

export function TemplateCard({ id, name, thumbnailUrl, keywords, createdAt }: Props) {
  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="relative h-48 bg-gray-100">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={name}
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
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-sm">{name}</h3>
        <div className="flex flex-wrap gap-1">
          {keywords.slice(0, 4).map((kw) => (
            <span
              key={kw}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              {kw}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          {new Date(createdAt).toLocaleDateString('ko-KR')}
        </p>
      </div>
    </div>
  )
}
