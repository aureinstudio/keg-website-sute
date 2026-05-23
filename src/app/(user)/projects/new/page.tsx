'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WizardLayout } from '@/components/user/WizardLayout'
import { TemplateSelector } from '@/components/user/TemplateSelector'
import { MenuBuilder } from '@/components/user/MenuBuilder'
import { PromptInput } from '@/components/user/PromptInput'
import { PagePreview } from '@/components/user/PagePreview'
import type { MenuItem } from '@/lib/types'

const WIZARD_STEPS = ['프로젝트 정보', '템플릿 선택', '메뉴 구조', '페이지 생성', '완료']

interface ProjectInfo { name: string; industry: string }

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({ name: '', industry: '' })
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([
    { id: '1', name: '홈', path: '/' },
  ])
  const [projectId, setProjectId] = useState('')
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [pageIds, setPageIds] = useState<Record<string, string>>({})
  const [screenshots, setScreenshots] = useState<Record<string, string>>({})
  const [approved, setApproved] = useState<Set<string>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState('')

  const currentMenu = menuItems[currentPageIndex]

  async function handleCreateProject() {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectInfo.name,
        industry: projectInfo.industry,
        templateId: selectedTemplate,
        menuStructure: menuItems,
      }),
    })
    const { projectId: pid } = await res.json()
    setProjectId(pid)

    // 모든 페이지 레코드 미리 생성
    const ids: Record<string, string> = {}
    for (let i = 0; i < menuItems.length; i++) {
      const pageRes = await fetch(`/api/projects/${pid}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: menuItems[i].name,
          pageOrder: i,
          prompt: prompts[menuItems[i].id] ?? '',
        }),
      })
      const { pageId } = await pageRes.json()
      ids[menuItems[i].id] = pageId
    }
    setPageIds(ids)
    setStep(3)
  }

  async function generateCurrentPage(feedback?: string) {
    const menuItem = menuItems[currentPageIndex]
    const pageId = pageIds[menuItem.id]
    if (!pageId) return

    setIsGenerating(true)
    setGenerationStatus('HTML 생성 중...')

    try {
      // 1. HTML 생성
      await fetch('/api/generate/html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, pageId, retryFeedback: feedback }),
      })

      setGenerationStatus('스크린샷 생성 중...')

      // 2. 스크린샷 생성
      const shotRes = await fetch('/api/generate/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      })
      const { screenshotUrl } = await shotRes.json()

      setScreenshots((prev) => ({ ...prev, [menuItem.id]: screenshotUrl }))
    } finally {
      setIsGenerating(false)
      setGenerationStatus('')
    }
  }

  async function approvePage() {
    const menuItem = menuItems[currentPageIndex]
    const pageId = pageIds[menuItem.id]
    await fetch(`/api/projects/${projectId}/pages/${pageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    setApproved((prev) => new Set([...prev, menuItem.id]))

    if (currentPageIndex < menuItems.length - 1) {
      setCurrentPageIndex((i) => i + 1)
    } else {
      setStep(4)
    }
  }

  return (
    <WizardLayout currentStep={step} steps={WIZARD_STEPS}>
      {/* Step 0: 프로젝트 정보 */}
      {step === 0 && (
        <div className="max-w-md space-y-6">
          <div>
            <h2 className="text-xl font-bold">프로젝트 정보</h2>
            <p className="text-gray-500 text-sm mt-1">만들 사이트에 대해 알려주세요</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">사이트 이름</label>
              <input
                value={projectInfo.name}
                onChange={(e) => setProjectInfo({ ...projectInfo, name: e.target.value })}
                placeholder="예: 스타트업 코리아"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">업종 (선택)</label>
              <input
                value={projectInfo.industry}
                onChange={(e) => setProjectInfo({ ...projectInfo, industry: e.target.value })}
                placeholder="예: IT 스타트업, 음식점, 디자인 회사"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={() => setStep(1)}
            disabled={!projectInfo.name}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
          >
            다음 →
          </button>
        </div>
      )}

      {/* Step 1: 템플릿 선택 */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold">디자인 스타일 선택</h2>
            <p className="text-gray-500 text-sm mt-1">원하는 디자인 스타일을 선택하세요</p>
          </div>
          <TemplateSelector value={selectedTemplate} onChange={setSelectedTemplate} />
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="px-4 py-2 border rounded-lg text-sm">
              ← 이전
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!selectedTemplate}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              다음 →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 메뉴 구조 */}
      {step === 2 && (
        <div className="max-w-md space-y-6">
          <div>
            <h2 className="text-xl font-bold">메뉴 구조 설정</h2>
            <p className="text-gray-500 text-sm mt-1">
              만들 페이지 목록을 설정하세요 (순서대로 생성됩니다)
            </p>
          </div>
          <MenuBuilder value={menuItems} onChange={setMenuItems} />
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-lg text-sm">
              ← 이전
            </button>
            <button
              onClick={handleCreateProject}
              disabled={menuItems.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              페이지 생성 시작 →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 페이지별 생성 */}
      {step === 3 && currentMenu && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">
                {currentPageIndex + 1} / {menuItems.length} 페이지
              </p>
              <h2 className="text-xl font-bold">"{currentMenu.name}" 페이지 생성</h2>
            </div>
            <div className="flex gap-1">
              {menuItems.map((m, i) => (
                <div
                  key={m.id}
                  className={`w-2 h-2 rounded-full ${
                    approved.has(m.id)
                      ? 'bg-green-500'
                      : i === currentPageIndex
                      ? 'bg-blue-500'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {!screenshots[currentMenu.id] ? (
            <div className="space-y-6">
              <PromptInput
                pageName={currentMenu.name}
                value={prompts[currentMenu.id] ?? ''}
                onChange={(v) =>
                  setPrompts((prev) => ({ ...prev, [currentMenu.id]: v }))
                }
              />
              {isGenerating ? (
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  {generationStatus}
                </div>
              ) : (
                <button
                  onClick={() => generateCurrentPage()}
                  disabled={!prompts[currentMenu.id]}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
                >
                  시안 생성
                </button>
              )}
            </div>
          ) : (
            <PagePreview
              screenshotUrl={screenshots[currentMenu.id]}
              pageName={currentMenu.name}
              onApprove={approvePage}
              onRetry={(feedback) => {
                setScreenshots((prev) => {
                  const next = { ...prev }
                  delete next[currentMenu.id]
                  return next
                })
                generateCurrentPage(feedback)
              }}
              isLoading={isGenerating}
            />
          )}
        </div>
      )}

      {/* Step 4: 완료 */}
      {step === 4 && (
        <div className="text-center py-12 space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-3xl">
            ✓
          </div>
          <div>
            <h2 className="text-2xl font-bold">완성!</h2>
            <p className="text-gray-500 mt-2">
              모든 페이지가 생성됐습니다. ZIP으로 다운로드하세요.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <a
              href={`/api/projects/${projectId}/download`}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              ZIP 다운로드
            </a>
            <button
              onClick={() => router.push('/projects/new')}
              className="px-6 py-3 border rounded-lg font-medium hover:bg-gray-50"
            >
              새 프로젝트 만들기
            </button>
          </div>
        </div>
      )}
    </WizardLayout>
  )
}
