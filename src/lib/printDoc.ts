// Browser-print document generator (no dependencies). Builds a standalone,
// self-styled HTML document for a prescription / discharge summary / referral,
// stamped with the doctor's e-signature, and opens the print dialog.

export type PrintDoc = {
  kind: 'Prescription' | 'Discharge Summary' | 'Referral Letter'
  patient: string
  patientMeta?: string        // e.g. "PT-20394 · 55y / Male"
  doctor: string
  signature: string
  date?: string
  bodyHtml: string            // pre-built inner HTML for the body
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function buildDocHtml(doc: PrintDoc): string {
  const date = doc.date ?? new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.kind)} — ${esc(doc.patient)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; margin: 0; padding: 40px; }
  .doc { max-width: 720px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 14px; }
  .brand { font-size: 20px; font-weight: 800; color: #0f172a; }
  .brand span { color: #2563eb; }
  .sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  .kind { font-size: 13px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; }
  .meta { display: flex; justify-content: space-between; margin: 18px 0; font-size: 13px; }
  .meta b { color: #0f172a; }
  .body { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
  .body h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; margin: 18px 0 6px; }
  .body ol { margin: 6px 0; padding-left: 20px; }
  .body li { margin: 3px 0; }
  .sign { margin-top: 56px; text-align: right; }
  .sign .line { font-family: 'Segoe Script', cursive; font-size: 18px; color: #0f172a; }
  .sign .name { font-size: 12px; color: #64748b; border-top: 1px solid #cbd5e1; display: inline-block; padding-top: 4px; margin-top: 4px; }
  .foot { margin-top: 28px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  @media print { body { padding: 0; } .doc { max-width: none; } }
</style></head>
<body><div class="doc">
  <div class="head">
    <div><div class="brand">Umang <span>HIMS</span></div><div class="sub">Umang HIMS · AI-First Hospital Management</div></div>
    <div style="text-align:right"><div class="kind">${esc(doc.kind)}</div><div class="sub">${esc(date)}</div></div>
  </div>
  <div class="meta"><div><b>${esc(doc.patient)}</b>${doc.patientMeta ? `<br><span class="sub">${esc(doc.patientMeta)}</span>` : ''}</div><div style="text-align:right">Consultant<br><b>${esc(doc.doctor)}</b></div></div>
  <div class="body">${doc.bodyHtml}</div>
  <div class="sign"><div class="line">${esc(doc.signature)}</div><div class="name">${esc(doc.signature)}</div></div>
  <div class="foot">This is a digitally generated document from Umang HIMS. Verify clinically.</div>
</div></body></html>`
}

export function openPrint(doc: PrintDoc): boolean {
  const html = buildDocHtml(doc)
  const w = window.open('', '_blank', 'width=820,height=1000')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.focus()
  // Let layout settle before invoking print.
  setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 300)
  return true
}

// Helpers to turn structured data into body HTML.
export const olFrom = (items: string[]) => `<ol>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ol>`
export const para = (label: string, text: string) => `<h3>${esc(label)}</h3>${esc(text)}`
export const pre = (text: string) => esc(text)
