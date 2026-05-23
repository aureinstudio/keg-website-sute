'use client'
import { useState } from 'react'
import type { MenuItem } from '@/lib/types'

interface Props {
  value: MenuItem[]
  onChange: (items: MenuItem[]) => void
}

export function MenuBuilder({ value, onChange }: Props) {
  const [newName, setNewName] = useState('')

  function addItem() {
    if (!newName.trim()) return
    const slug = newName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-가-힣]/g, '')
    onChange([
      ...value,
      { id: Date.now().toString(), name: newName.trim(), path: `/${slug}` },
    ])
    setNewName('')
  }

  function removeItem(id: string) {
    onChange(value.filter((item) => item.id !== id))
  }

  function moveUp(index: number) {
    if (index === 0) return
    const newItems = [...value]
    ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
    onChange(newItems)
  }

  function moveDown(index: number) {
    if (index === value.length - 1) return
    const newItems = [...value]
    ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
    onChange(newItems)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {value.map((item, i) => (
          <div
            key={item.id}
            className="flex items-center gap-2 p-3 border rounded-lg bg-white"
          >
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={i === 0}
                className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 leading-none"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={i === value.length - 1}
                className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 leading-none"
              >
                ▼
              </button>
            </div>
            <span className="text-gray-400 text-sm w-5 text-center">{i + 1}</span>
            <span className="flex-1 font-medium text-sm">{item.name}</span>
            <span className="text-xs text-gray-400">{item.path}</span>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
        {value.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4 border border-dashed rounded-lg">
            아래에서 페이지를 추가하세요
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="페이지 이름 (예: 서비스 소개)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addItem()
            }
          }}
          className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={addItem}
          className="px-4 py-2 border border-blue-500 text-blue-600 rounded-md text-sm hover:bg-blue-50"
        >
          추가
        </button>
      </div>
    </div>
  )
}
