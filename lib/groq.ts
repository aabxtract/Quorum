import Groq from 'groq-sdk'

let _groq: Groq | null = null
function getGroq(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

export async function getAgentReasoning(params: {
  question: string
  currentPrice: number
  targetValue: number
  direction: string
  winningSide: string
}): Promise<string> {
  const { question, currentPrice, targetValue, direction, winningSide } = params

  const response = await getGroq().chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    max_tokens: 150,
    messages: [
      {
        role: 'system',
        content: `You are Quorum's AI resolution agent. You resolve crypto prediction markets.
You must respond with ONLY a single sentence explaining why the market resolved the way it did.
Be specific about the price. Be concise. No markdown.`
      },
      {
        role: 'user',
        content: `Market: "${question}"
Current price: $${currentPrice}
Condition: price ${direction} $${targetValue}
Result: ${winningSide.toUpperCase()} wins

Explain the resolution in one sentence.`
      }
    ]
  })

  return response.choices[0]?.message?.content || 'Market resolved by price condition.'
}
