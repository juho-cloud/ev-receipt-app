import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const apiKey = formData.get('apiKey') || process.env.ANTHROPIC_API_KEY

    if (!file || !apiKey) {
      return Response.json({ error: 'Missing file or API key. Set ANTHROPIC_API_KEY in environment variables.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const mimeType = file.type

    const client = new Anthropic({ apiKey })

    const isPdf = mimeType === 'application/pdf'

    const contentBlock = isPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 }
        }
      : {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 }
        }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `This is an EV charging receipt. It may be in English, Finnish, or Swedish.

Extract:
1. The total amount charged in euros (just the number, e.g. 12.50)
2. The date of the charging session (in DD.MM.YYYY format)
3. The vendor/charging network name (e.g. Recharge, Virta, ABC, Tesla, Helen, Fortum Charge & Drive, etc.)

Respond ONLY with a valid JSON object, no markdown, no backticks, no extra text:
{"amount": "12.50", "date": "15.03.2024", "vendor": "Recharge"}

If you cannot find a value, use an empty string "".`
            }
          ]
        }
      ]
    })

    const text = response.content.map(c => c.text || '').join('').trim()
    const parsed = JSON.parse(text)

    return Response.json({ success: true, ...parsed })
  } catch (err) {
    console.error('Extract error:', err)
    return Response.json({ error: err.message || 'Extraction failed' }, { status: 500 })
  }
}
