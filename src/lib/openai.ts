import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function createEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  })
  return response.data[0].embedding
}

export async function generateImage(prompt: string): Promise<string> {
  const response = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1536x1024',
    quality: 'high',
  })
  return response.data?.[0]?.url ?? ''
}
