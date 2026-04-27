import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 60

// Compress image to JPEG at reduced size before embedding
async function compressImage(buffer) {
  return await sharp(buffer)
    .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer()
}

function parseDate(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split(/[.\-\/]/)
  if (parts.length === 3) {
    const isEuropean = parts[2].length === 4
    const year = isEuropean ? parseInt(parts[2]) : parseInt(parts[0])
    const month = parseInt(parts[1]) - 1
    const day = isEuropean ? parseInt(parts[0]) : parseInt(parts[2])
    const d = new Date(year, month, day)
    return isNaN(d) ? null : d
  }
  return null
}

function formatDate(d) {
  if (!d) return '—'
  return d.toLocaleDateString('fi-FI')
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const receiptsJson = formData.get('receipts')
    const receipts = JSON.parse(receiptsJson)

    const pdfDoc = await PDFDocument.create()
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const W = 595
    const H = 842
    const margin = 48
    const col = rgb(0.13, 0.13, 0.13)
    const muted = rgb(0.5, 0.5, 0.5)
    const accent = rgb(0.09, 0.37, 0.65)
    const light = rgb(0.96, 0.96, 0.96)
    const white = rgb(1, 1, 1)
    const dark = rgb(0.08, 0.08, 0.08)

    // --- COVER PAGE ---
    const cover = pdfDoc.addPage([W, H])

    // Header bar
    cover.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: accent })
    cover.drawText('EV Charging Expense Report', {
      x: margin, y: H - 52, size: 22, font: helveticaBold, color: white
    })
    cover.drawText(`Generated ${formatDate(new Date())}`, {
      x: margin, y: H - 74, size: 11, font: helvetica, color: rgb(0.75, 0.88, 1)
    })

    // Summary section
    const doneReceipts = receipts.filter(r => r.amount)
    const total = doneReceipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    const allDates = doneReceipts.map(r => parseDate(r.date)).filter(Boolean).sort((a, b) => a - b)
    const firstDate = allDates.length ? formatDate(allDates[0]) : '—'
    const lastDate = allDates.length ? formatDate(allDates[allDates.length - 1]) : '—'

    const summaryY = H - 180
    cover.drawText('SUMMARY', { x: margin, y: summaryY + 10, size: 10, font: helveticaBold, color: muted })
    cover.drawLine({ start: { x: margin, y: summaryY }, end: { x: W - margin, y: summaryY }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })

    const stats = [
      { label: 'Total amount', value: `€${total.toFixed(2)}` },
      { label: 'Number of receipts', value: `${doneReceipts.length}` },
      { label: 'First charging', value: firstDate },
      { label: 'Last charging', value: lastDate },
    ]

    stats.forEach((s, i) => {
      const y = summaryY - 36 - i * 36
      cover.drawRectangle({ x: margin, y: y - 8, width: W - margin * 2, height: 30, color: i % 2 === 0 ? light : white })
      cover.drawText(s.label, { x: margin + 12, y: y + 6, size: 11, font: helvetica, color: muted })
      cover.drawText(s.value, { x: W - margin - helveticaBold.widthOfTextAtSize(s.value, 13) - 12, y: y + 5, size: 13, font: helveticaBold, color: col })
    })

    // Receipts table
    const tableY = summaryY - 36 * stats.length - 60
    cover.drawText('ITEMISED RECEIPTS', { x: margin, y: tableY + 10, size: 10, font: helveticaBold, color: muted })
    cover.drawLine({ start: { x: margin, y: tableY }, end: { x: W - margin, y: tableY }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })

    const colDate = margin + 12
    const colVendor = margin + 120
    const colAmount = W - margin - 12

    // Table header
    cover.drawRectangle({ x: margin, y: tableY - 24, width: W - margin * 2, height: 24, color: accent })
    cover.drawText('Date', { x: colDate, y: tableY - 15, size: 10, font: helveticaBold, color: white })
    cover.drawText('Vendor / Network', { x: colVendor, y: tableY - 15, size: 10, font: helveticaBold, color: white })
    cover.drawText('Amount', { x: colAmount - 40, y: tableY - 15, size: 10, font: helveticaBold, color: white })

    let rowY = tableY - 24
    doneReceipts.forEach((r, i) => {
      rowY -= 24
      if (rowY < margin + 24) return
      cover.drawRectangle({ x: margin, y: rowY, width: W - margin * 2, height: 24, color: i % 2 === 0 ? light : white })
      cover.drawText(r.date || '—', { x: colDate, y: rowY + 7, size: 10, font: helvetica, color: col })

      const vendorText = (r.vendor || '—').substring(0, 30)
      cover.drawText(vendorText, { x: colVendor, y: rowY + 7, size: 10, font: helvetica, color: col })

      const amtText = `€${parseFloat(r.amount || 0).toFixed(2)}`
      cover.drawText(amtText, { x: colAmount - helvetica.widthOfTextAtSize(amtText, 10), y: rowY + 7, size: 10, font: helvetica, color: col })
    })

    // Total row
    rowY -= 24
    cover.drawRectangle({ x: margin, y: rowY, width: W - margin * 2, height: 24, color: dark })
    cover.drawText('TOTAL', { x: colDate, y: rowY + 7, size: 10, font: helveticaBold, color: white })
    const totalText = `€${total.toFixed(2)}`
    cover.drawText(totalText, { x: colAmount - helveticaBold.widthOfTextAtSize(totalText, 11), y: rowY + 7, size: 11, font: helveticaBold, color: white })

    // Footer
    cover.drawText('This report was generated automatically from uploaded receipts.', {
      x: margin, y: margin, size: 9, font: helvetica, color: muted
    })

    // --- RECEIPT PAGES ---
    for (let i = 0; i < receipts.length; i++) {
      const r = receipts[i]
      if (!r.fileData || !r.fileType) continue

      const fileBuffer = Buffer.from(r.fileData, 'base64')

      if (r.fileType === 'application/pdf') {
        try {
          const srcPdf = await PDFDocument.load(fileBuffer)
          const pageCount = srcPdf.getPageCount()
          for (let p = 0; p < pageCount; p++) {
            const [copied] = await pdfDoc.copyPages(srcPdf, [p])
            const page = pdfDoc.addPage(copied)

            // Add header label on each copied page
            const { width, height } = page.getSize()
            page.drawRectangle({ x: 0, y: height - 28, width, height: 28, color: rgb(0.95, 0.95, 0.95) })
            page.drawText(`Receipt ${i + 1} of ${receipts.length}  ·  ${r.date || ''}  ·  ${r.vendor || ''}  ·  ${r.amount ? '€' + parseFloat(r.amount).toFixed(2) : ''}`, {
              x: 12, y: height - 18, size: 9, font: helvetica, color: muted
            })
          }
        } catch (e) {
          console.error('PDF embed error', e)
        }
      } else {
        // Image — compress before embedding
        try {
          const compressedBuffer = await compressImage(fileBuffer)
          const embeddedImage = await pdfDoc.embedJpg(compressedBuffer)

          const page = pdfDoc.addPage([W, H])
          const headerH = 36

          // Header
          page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: rgb(0.95, 0.95, 0.95) })
          page.drawText(`Receipt ${i + 1} of ${receipts.length}`, { x: margin, y: H - 22, size: 10, font: helveticaBold, color: col })
          const meta = [r.date, r.vendor, r.amount ? `€${parseFloat(r.amount).toFixed(2)}` : ''].filter(Boolean).join('  ·  ')
          if (meta) page.drawText(meta, { x: margin + 120, y: H - 22, size: 10, font: helvetica, color: muted })

          // Scale image to fit page
          const maxW = W - margin * 2
          const maxH = H - headerH - margin * 2
          const { width: iw, height: ih } = embeddedImage
          const scale = Math.min(maxW / iw, maxH / ih, 1)
          const dw = iw * scale
          const dh = ih * scale
          const x = (W - dw) / 2
          const y = (H - headerH - dh) / 2 - margin / 2

          page.drawImage(embeddedImage, { x, y, width: dw, height: dh })
        } catch (e) {
          console.error('Image embed error', e)
        }
      }
    }

    const pdfBytes = await pdfDoc.save()

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ev_charging_report_${new Date().toISOString().slice(0,10)}.pdf"`
      }
    })
  } catch (err) {
    console.error('Export error:', err)
    return Response.json({ error: err.message || 'Export failed' }, { status: 500 })
  }
}
