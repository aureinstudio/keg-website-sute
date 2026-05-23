import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-gray-900">
            Homepage Generator
          </Link>
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-medium">
            관리자
          </span>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin/templates" className="text-gray-600 hover:text-gray-900">
              템플릿
            </Link>
          </nav>
        </div>
        <Link href="/projects/new" className="text-sm text-blue-600 hover:underline">
          사용자 화면 →
        </Link>
      </header>
      <main>{children}</main>
    </div>
  )
}
