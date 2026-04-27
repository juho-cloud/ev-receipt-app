const PASSWORD = process.env.APP_PASSWORD || 'changeme'
const COOKIE = 'ev_app_auth'

export async function POST(request) {
  const { password } = await request.json()

  if (password !== PASSWORD) {
    return Response.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const response = Response.json({ success: true })
  response.headers.set(
    'Set-Cookie',
    `${COOKIE}=${PASSWORD}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}`
  )
  return response
}
