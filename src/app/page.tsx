import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-8 p-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Homepage Generator</h1>
          <p className="text-gray-500 mt-3 text-lg">
            AI가 디자인 스타일을 학습해 홈페이지를 자동으로 만들어줍니다
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Link
            href="/projects/new"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            홈페이지 만들기 →
          </Link>
          <Link
            href="/admin/templates"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors"
          >
            관리자 (스타일 학습)
          </Link>
        </div>
      </div>
    </main>
  )
}
