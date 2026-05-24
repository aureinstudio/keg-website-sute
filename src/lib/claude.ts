import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5'

export async function claudeGenerate(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8192
): Promise<string> {
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const block = message.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
    return block.text
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Claude API call failed: ${detail}`)
  }
}

export async function claudeAnalyzeImage(
  imageBase64: string,
  prompt: string
): Promise<string> {
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })
    const block = message.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
    return block.text
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Claude API image analysis failed: ${detail}`)
  }
}
