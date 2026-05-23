'use client'
import { useState } from 'react'
import Image from 'next/image'

interface Props {
  screenshotUrl: string
  pageName: string
  onApprove: () => void
  onRetry: (feedback: string) => void
  isLoading: boolean
}

export function PagePreview({ screenshotUrl, pageName, onApprove, onRetry, isLoading }: Props) {
  const [customFeedback, setCustomFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  function handleRetry() {
    const feedback = customFeedback.trim() || '레이아웃을 개선하고 가독성을 높여주세요'
    onRetry(feedback)
    setCustomFeedback('')
    setShowFeedback(false)
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full rounded-xl overflow-hidden border shadow-sm bg-gray-100"
        style={{ aspectRatio: '16/9' }}>
        <Image
          src={screenshotUrl}
          alt={`${pageName} 시안`}
          fill
          className="object-cover object-top"
          unoptimized
        />
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-600">재생성 중...</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onApprove}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          ✓ 승인
        </button>
        <button
          type="button"
          onClick={() => setShowFeedback(!showFeedback)}
          disabled={isLoading}
          className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          다시 생성
        </button>
        <a
          href={screenshotUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 underline"
        >
          원본 크기로 보기
        </a>
      </div>

      {showFeedback && (
        <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
          <label className="text-sm font-medium">수정 요청 사항 (선택)</label>
          <textarea
            value={customFeedback}
            onChange={(e) => setCustomFeedback(e.target.value)}
            placeholder="예: 히어로 이미지를 더 크게, 버튼 색상을 더 강렬하게..."
            rows={3}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
          />
          <button
            onClick={handleRetry}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            재생성
          </button>
        </div>
      )}
    </div>
  )
}
