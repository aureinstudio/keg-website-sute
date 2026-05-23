'use client'
import { useState } from 'react'

type Step = 'idle' | 'analyzing' | 'done' | 'error'

const STEP_LABELS: Record<Step, string> = {
  idle: '',
  analyzing: 'AI가 디자인 스타일을 분석하고 있습니다...',
  done: '완료! 템플릿이 저장됐습니다.',
  error: '오류가 발생했습니다.',
}

interface Props {
  onSuccess: (templateId: string) => void
}

export function TemplateUploader({ onSuccess }: Props) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url || !name) return

    setStep('analyzing')
    setError('')
    setProgress(30)

    try {
      const timer = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 85))
      }, 3000)

      const res = await fetch('/api/templates/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name }),
      })

      clearInterval(timer)
      setProgress(100)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? '분석 실패')
      }

      const { templateId } = await res.json()
      setStep('done')
      setTimeout(() => onSuccess(templateId), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
      setStep('error')
      setProgress(0)
    }
  }

  const isLoading = step === 'analyzing'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium">
          템플릿 이름
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 클린 코퍼레이트"
          required
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="url" className="block text-sm font-medium">
          사이트 URL
        </label>
        <input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      {step === 'analyzing' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{STEP_LABELS[step]}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {step === 'done' && (
        <p className="text-sm text-green-600 font-medium">{STEP_LABELS.done}</p>
      )}

      {step === 'error' && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? '분석 중...' : '분석 시작'}
      </button>
    </form>
  )
}
