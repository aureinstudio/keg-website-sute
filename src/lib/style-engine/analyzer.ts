import { claudeGenerate } from '@/lib/claude'
import type { StyleProfile } from '@/lib/types'

export class AnalysisError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'AnalysisError'
  }
}

const ANALYSIS_SYSTEM_PROMPT = `You are a web design analyzer. Extract design tokens and CSS patterns from HTML/CSS source code.

Return ONLY a valid JSON object with this exact structure:
{
  "colors": {
    "primary": "#hexcolor",
    "secondary": "#hexcolor",
    "accent": "#hexcolor",
    "background": "#hexcolor",
    "text": "#hexcolor"
  },
  "fonts": {
    "heading": "font-family-name",
    "body": "font-family-name",
    "size": { "base": "16px", "heading": "32px" }
  },
  "layout": {
    "containerWidth": "1200px",
    "sectionPadding": "80px",
    "gridColumns": 12
  },
  "cssSnippets": {
    "header": "CSS rules for header section",
    "hero": "CSS rules for hero/banner section",
    "card": "CSS rules for card components",
    "footer": "CSS rules for footer section"
  },
  "keywords": ["design style keyword 1", "keyword 2", "keyword 3"]
}

Keywords should describe the design mood in Korean (e.g. "미니멀", "기업형", "다크톤", "여백 넉넉").
Return ONLY the JSON, no explanation, no code fences.`

export async function analyzeStyle(html: string, css: string): Promise<StyleProfile> {
  const truncatedHtml = html.slice(0, 8000)
  const truncatedCss = css.slice(0, 4000)

  const userPrompt = `Analyze this website's design:\n\nHTML:\n${truncatedHtml}\n\nCSS:\n${truncatedCss}`

  let raw: string
  try {
    raw = await claudeGenerate(ANALYSIS_SYSTEM_PROMPT, userPrompt, 2048)
  } catch (err) {
    throw new AnalysisError('Claude API call failed', err)
  }

  // JSON 블록이 ``` ``` 로 감싸진 경우 제거
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = (jsonMatch ? jsonMatch[1] : raw).trim()

  try {
    return JSON.parse(jsonStr) as StyleProfile
  } catch (err) {
    throw new AnalysisError(
      `Failed to parse analysis result: ${jsonStr.slice(0, 200)}`,
      err
    )
  }
}
