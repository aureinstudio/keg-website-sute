import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Homepage Generator',
  description: 'AI 기반 홈페이지 자동 생성',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
