export async function GET() {
  return Response.json({ hasKey: !!process.env.ANTHROPIC_API_KEY })
}
