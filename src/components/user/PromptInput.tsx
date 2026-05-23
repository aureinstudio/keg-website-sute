'use client'

const HINTS: Record<string, string[]> = {
  홈: [
    '히어로 섹션에 강렬한 CTA 버튼을 포함해주세요',
    '회사의 핵심 가치 3가지를 아이콘과 함께 표시해주세요',
    '신뢰감을 주는 고객사 로고 섹션을 추가해주세요',
  ],
  서비스: [
    '서비스 3~4개를 카드 형태로 나열해주세요',
    '각 서비스별 가격이나 특징을 표로 비교해주세요',
    '서비스 신청 CTA 버튼을 눈에 띄게 배치해주세요',
  ],
  회사소개: [
    '회사의 연혁을 타임라인 형식으로 보여주세요',
    '팀원 소개를 사진과 함께 그리드로 배치해주세요',
    '비전과 미션을 강조해서 보여주세요',
  ],
  포트폴리오: [
    '프로젝트를 이미지 그리드로 보여주세요',
    '카테고리 필터 버튼을 상단에 배치해주세요',
    '각 작업물에 클라이언트 이름과 설명을 추가해주세요',
  ],
  연락처: [
    '연락처 폼(이름, 이메일, 메시지)을 중앙에 배치해주세요',
    '지도와 주소, 전화번호를 함께 표시해주세요',
    '빠른 응답을 약속하는 문구를 추가해주세요',
  ],
}

const DEFAULT_HINTS = [
  '핵심 내용을 헤드라인으로 크게 강조해주세요',
  '관련 이미지나 일러스트레이션 공간을 포함해주세요',
  '다음 행동을 유도하는 CTA 버튼을 배치해주세요',
]

interface Props {
  pageName: string
  value: string
  onChange: (v: string) => void
}

export function PromptInput({ pageName, value, onChange }: Props) {
  const hints = HINTS[pageName] ?? DEFAULT_HINTS

  function appendHint(hint: string) {
    onChange(value ? `${value}\n${hint}` : hint)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          "{pageName}" 페이지 설명
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="이 페이지에 담을 내용과 스타일을 설명해주세요..."
          rows={5}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-gray-400 font-medium">
          힌트 — 클릭하면 추가됩니다
        </p>
        <div className="flex flex-col gap-1">
          {hints.map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => appendHint(hint)}
              className="text-left text-xs text-blue-600 hover:underline hover:text-blue-800"
            >
              + {hint}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
