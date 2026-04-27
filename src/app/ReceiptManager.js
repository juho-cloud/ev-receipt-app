'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

const STATUS = { pending: 'Pending', processing: 'Processing…', done: 'Done', error: 'Error' }

function parseDate(str) {
  if (!str) return null
  const p = str.split(/[.\-\/]/)
  if (p.length !== 3) return null
  const isEU = p[2].length === 4
  const y = isEU ? p[2] : p[0], m = p[1], d = isEU ? p[0] : p[2]
  const dt = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`)
  return isNaN(dt) ? null : dt
}

function fmtDate(d) {
  if (!d) return '—'
  return d.toLocaleDateString('fi-FI')
}

export default function ReceiptManager() {
  const [receipts, setReceipts] = useState([])
  const [apiKey, setApiKey] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [serverHasKey, setServerHasKey] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    fetch('/api/check-key').then(r => r.json()).then(d => {
      if (d.hasKey) setServerHasKey(true)
    }).catch(() => {})
  }, [])

  const addFiles = useCallback((files) => {
    const allowed = Array.from(files).filter(f =>
      f.type.startsWith('image/') || f.type === 'application/pdf'
    )
    setReceipts(prev => [
      ...prev,
      ...allowed.map(f => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        date: '', amount: '', vendor: '',
        status: 'pending'
      }))
    ])
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const updateField = (id, field, value) => {
    setReceipts(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const deleteReceipt = (id) => setReceipts(prev => prev.filter(r => r.id !== id))

  const saveKey = () => {
    if (apiKey.trim()) setKeySaved(true)
  }

  // Summary calculations
  const done = receipts.filter(r => r.amount)
  const total = done.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const dates = done.map(r => parseDate(r.date)).filter(Boolean).sort((a, b) => a - b)
  const firstDate = dates.length ? fmtDate(dates[0]) : '—'
  const lastDate = dates.length ? fmtDate(dates[dates.length - 1]) : '—'

  const processAll = async () => {
    if (!serverHasKey && !apiKey.trim()) { alert('Please enter your Claude API key first.'); return }
    const pending = receipts.filter(r => r.status === 'pending' || r.status === 'error')
    if (!pending.length) { alert('No pending receipts to process.'); return }

    setProcessing(true); setProgress(0)

    for (let i = 0; i < pending.length; i++) {
      const r = pending[i]
      setReceipts(prev => prev.map(x => x.id === r.id ? { ...x, status: 'processing' } : x))
      setProgress(Math.round((i / pending.length) * 100))

      try {
        const fd = new FormData()
        fd.append('file', r.file)
        if (apiKey.trim()) fd.append('apiKey', apiKey.trim())

        const res = await fetch('/api/extract', { method: 'POST', body: fd })
        const data = await res.json()

        if (data.error) throw new Error(data.error)

        setReceipts(prev => prev.map(x => x.id === r.id
          ? { ...x, status: 'done', date: data.date || '', amount: data.amount || '', vendor: data.vendor || '' }
          : x
        ))
      } catch (err) {
        console.error(err)
        setReceipts(prev => prev.map(x => x.id === r.id ? { ...x, status: 'error' } : x))
      }
    }

    setProgress(100); setProcessing(false)
  }

  const exportPdf = async () => {
    const exportable = receipts.filter(r => r.status === 'done')
    if (!exportable.length) { alert('No processed receipts to export.'); return }

    setExporting(true)
    try {
      // Read file data as base64
      const withData = await Promise.all(
        receipts.map(async r => {
          if (r.status !== 'done') return { ...r, fileData: null, fileType: null }
          return new Promise((res) => {
            const reader = new FileReader()
            reader.onload = () => res({
              ...r,
              fileData: reader.result.split(',')[1],
              fileType: r.file.type,
              fileName: r.file.name
            })
            reader.readAsDataURL(r.file)
          })
        })
      )

      const fd = new FormData()
      fd.append('receipts', JSON.stringify(withData.map(r => ({
        date: r.date,
        amount: r.amount,
        vendor: r.vendor,
        status: r.status,
        fileData: r.fileData || null,
        fileType: r.fileType || null,
        fileName: r.fileName || ''
      }))))

      const res = await fetch('/api/export-pdf', { method: 'POST', body: fd })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ev_charging_report_${new Date().toISOString().slice(0,10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed: ' + err.message)
    }
    setExporting(false)
  }

  const exportCsv = () => {
    const rows = ['Date,Vendor,Amount (EUR),File']
    done.forEach(r => rows.push(`"${r.date}","${r.vendor}","${r.amount}","${r.file.name}"`))
    rows.push(`"","Total","${total.toFixed(2)}",""`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'ev_charging.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const hasDone = receipts.some(r => r.status === 'done')
  const hasPending = receipts.some(r => r.status === 'pending' || r.status === 'error')

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>EV charging receipt manager</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>
          Upload receipts in English, Finnish or Swedish — AI extracts dates and amounts, then exports a single PDF with everything bundled.
        </p>
      </div>

      {/* API Key — hidden if server has ANTHROPIC_API_KEY configured */}
      {!serverHasKey && (
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Claude API key</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setKeySaved(false) }}
            placeholder="sk-ant-api03-..."
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '0.5px solid var(--border2)', borderRadius: 'var(--radius)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace', outline: 'none' }}
          />
          <button onClick={saveKey} style={btnStyle(keySaved ? 'success' : 'default')}>
            {keySaved ? '✓ Saved' : 'Save key'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
          Your key is only used server-side to call the Anthropic API and is never stored or logged.
          Get one at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>console.anthropic.com</a>
        </p>
      </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current.click()}
        style={{
          border: `1.5px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'var(--accent-bg)' : 'var(--bg2)',
          transition: 'all 0.15s',
          marginBottom: '1.5rem'
        }}
      >
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
        <div style={{ fontSize: 24, marginBottom: 8 }}>📎</div>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Click or drag to upload receipts</div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>JPG, PNG, PDF · multiple files · English, Finnish, Swedish</div>
      </div>

      {/* Progress bar */}
      {processing && (
        <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total amount', value: done.length ? `€${total.toFixed(2)}` : '—' },
          { label: 'First charging', value: firstDate },
          { label: 'Last charging', value: lastDate },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {receipts.length > 0 ? (
        <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['File', 'Date', 'Amount (€)', 'Vendor', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receipts.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < receipts.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '8px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)', fontSize: 12 }} title={r.file.name}>{r.file.name}</td>
                  <td style={{ padding: '4px 12px' }}>
                    <input value={r.date} onChange={e => updateField(r.id, 'date', e.target.value)} placeholder="DD.MM.YYYY" style={editableStyle} />
                  </td>
                  <td style={{ padding: '4px 12px' }}>
                    <input value={r.amount} onChange={e => updateField(r.id, 'amount', e.target.value)} placeholder="0.00" style={{ ...editableStyle, width: 80 }} />
                  </td>
                  <td style={{ padding: '4px 12px' }}>
                    <input value={r.vendor} onChange={e => updateField(r.id, 'vendor', e.target.value)} placeholder="—" style={editableStyle} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={badgeStyle(r.status)}>{STATUS[r.status]}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <button onClick={() => deleteReceipt(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 14, padding: '2px 6px', borderRadius: 4 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>
          No receipts yet — upload some files above.
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={processAll}
          disabled={processing || !hasPending || (!serverHasKey && !apiKey)}
          style={btnStyle('primary')}
        >
          {processing ? `Extracting… ${progress}%` : 'Extract with AI'}
        </button>
        <button
          onClick={exportPdf}
          disabled={exporting || !hasDone}
          style={btnStyle('default')}
        >
          {exporting ? 'Generating PDF…' : 'Export PDF report'}
        </button>
        <button onClick={exportCsv} disabled={!hasDone} style={btnStyle('default')}>
          Export CSV
        </button>
        {receipts.length > 0 && (
          <button onClick={() => setReceipts([])} style={{ ...btnStyle('default'), marginLeft: 'auto', color: 'var(--error-text)' }}>
            Clear all
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: '1.5rem' }}>
        The exported PDF contains a cover page with your summary, then each receipt as its own page — ready to send to your company.
      </p>
    </div>
  )
}

const editableStyle = {
  border: 'none',
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: 13,
  color: 'var(--text)',
  width: '100%',
  padding: '4px 6px',
  borderRadius: 4,
  outline: 'none',
}

function badgeStyle(status) {
  const map = {
    pending: { background: 'var(--warn-bg)', color: 'var(--warn-text)' },
    processing: { background: 'var(--accent-bg)', color: 'var(--accent)' },
    done: { background: 'var(--success-bg)', color: 'var(--success-text)' },
    error: { background: 'var(--error-bg)', color: 'var(--error-text)' },
  }
  return {
    display: 'inline-block',
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 99,
    fontWeight: 500,
    ...(map[status] || {})
  }
}

function btnStyle(variant) {
  const base = {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    border: '0.5px solid var(--border2)',
    borderRadius: 'var(--radius)',
    background: 'var(--bg)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.1s',
  }
  if (variant === 'primary') return { ...base, background: 'var(--accent)', color: '#fff', border: 'none' }
  if (variant === 'success') return { ...base, background: 'var(--success-bg)', color: 'var(--success-text)', border: 'none' }
  return base
}
