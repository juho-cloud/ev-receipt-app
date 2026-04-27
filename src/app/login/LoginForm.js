'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError('Incorrect password. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0efed',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{
        background: 'white',
        border: '0.5px solid rgba(0,0,0,0.12)',
        borderRadius: 14,
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: 360,
      }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: '#1a1a1a' }}>
            EV receipt manager
          </h1>
          <p style={{ fontSize: 13, color: '#888' }}>Enter the password to continue</p>
        </div>

        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              border: `0.5px solid ${error ? '#E24B4A' : 'rgba(0,0,0,0.2)'}`,
              borderRadius: 8,
              marginBottom: error ? 8 : 16,
              outline: 'none',
              fontFamily: 'inherit',
              background: 'white',
              color: '#1a1a1a',
              display: 'block'
            }}
          />

          {error && (
            <p style={{ fontSize: 12, color: '#A32D2D', marginBottom: 12, background: '#FCEBEB', padding: '6px 10px', borderRadius: 6 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: 14,
              fontWeight: 500,
              background: loading || !password ? '#aaa' : '#185FA5',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s'
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
