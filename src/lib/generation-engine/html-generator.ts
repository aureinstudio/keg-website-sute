import { claudeGenerate } from '@/lib/claude'
import type { GenerationContext } from '@/lib/types'

function buildSystemPrompt(ctx: GenerationContext): string {
  const { styleProfile: p } = ctx
  return `You are an expert Korean web designer and developer. Generate a complete, single-file HTML page.

DESIGN TOKENS (follow exactly):
- Primary color: ${p.colors.primary}
- Secondary: ${p.colors.secondary}
- Accent: ${p.colors.accent}
- Background: ${p.colors.background}
- Text: ${p.colors.text}
- Heading font: ${p.fonts.heading}
- Body font: ${p.fonts.body}
- Base font size: ${p.fonts.size.base}
- Heading font size: ${p.fonts.size.heading}
- Container width: ${p.layout.containerWidth}
- Section padding: ${p.layout.sectionPadding}

CSS PATTERNS TO FOLLOW:
Header: ${p.cssSnippets.header}
Hero: ${p.cssSnippets.hero}
Card: ${p.cssSnippets.card}
Footer: ${p.cssSnippets.footer}

REQUIREMENTS:
1. Return ONLY the complete HTML file starting with <!DOCTYPE html>
2. Use CSS custom properties in :root: --color-primary, --color-secondary, --color-accent, --color-bg, --color-text, --font-heading, --font-body
3. Include responsive design with mobile breakpoint at 768px
4. Load fonts from Google Fonts CDN
5. Navigation must include ALL menu items provided
6. Write all content in Korean — realistic, not placeholder text
7. No external JavaScript libraries — vanilla JS only if needed
8. Do not wrap output in code fences — return raw HTML only`
}

function buildUserPrompt(ctx: GenerationContext): string {
  const navLinks = ctx.menuItems
    .map((m) => `${m.name} (${m.path})`)
    .join(', ')

  const existingNote = ctx.existingPages?.length
    ? `\n\nCONSISTENCY NOTE: Other pages already exist. Reuse these CSS variables exactly:\n${ctx.existingPages[0].cssVars}`
    : '\nThis is the first page — define all CSS custom properties in :root.'

  return `Generate the "${ctx.currentPage}" page.

Navigation items: ${navLinks}
Current active page: ${ctx.currentPage}

Design instructions:
${ctx.userPrompt}
${existingNote}`
}

export async function generatePageHtml(
  ctx: GenerationContext,
  retryFeedback?: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(ctx)
  const baseUserPrompt = buildUserPrompt(ctx)
  const userPrompt = retryFeedback
    ? `${baseUserPrompt}\n\nPREVIOUS ATTEMPT ISSUE: ${retryFeedback}\nGenerate an improved version addressing this issue.`
    : baseUserPrompt

  const raw = await claudeGenerate(systemPrompt, userPrompt, 8192)

  // 코드 블록 감싸진 경우 제거
  const html = raw
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  if (!html.toLowerCase().startsWith('<!doctype')) {
    throw new Error('Generated content is not valid HTML — missing DOCTYPE')
  }

  return html
}

export function extractCssVars(html: string): string {
  const rootMatch = html.match(/:root\s*\{([^}]+)\}/)
  return rootMatch ? `:root{${rootMatch[1]}}` : ''
}
