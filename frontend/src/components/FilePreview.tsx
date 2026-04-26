'use client'

import { useEffect, useState } from 'react'
import styles from './FilePreview.module.css'

// ── CSV ───────────────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 500)
    .map(line => {
      const cols: string[] = []
      let cur = '', inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
        else if (ch === ',' && !inQ) { cols.push(cur); cur = '' }
        else cur += ch
      }
      cols.push(cur)
      return cols
    })
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmlAttachment {
  index: number
  filename: string
  size: number
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'pdf' | 'image' }
  | { status: 'csv'; headers: string[]; rows: string[][] }
  | { status: 'eml'; from: string; to: string; cc: string; subject: string; date: string; body: string; isHtml: boolean; attachments: EmlAttachment[] }
  | { status: 'text'; content: string }
  | { status: 'unsupported' }

interface Props {
  readonly filename: string
  readonly path: string
  readonly description?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilePreview({ filename, path, description }: Props) {
  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' })
  const [enlarged, setEnlarged] = useState(false)

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const fileUrl = `/api/files?path=${encodeURIComponent(path)}&preview=true`
  const downloadUrl = `/api/files?path=${encodeURIComponent(path)}`

  useEffect(() => {
    if (ext === 'pdf') { setPreview({ status: 'pdf' }); return }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) { setPreview({ status: 'image' }); return }

    setPreview({ status: 'loading' })

    if (ext === 'eml' || ext === 'msg') {
      fetch(`/api/eml/parse?path=${encodeURIComponent(path)}`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(data => setPreview({
          status: 'eml',
          from: data.from ?? '',
          to: data.to ?? '',
          cc: data.cc ?? '',
          subject: data.subject ?? '',
          date: data.date ?? '',
          body: data.body ?? '',
          isHtml: data.isHtml ?? false,
          attachments: data.attachments ?? [],
        }))
        .catch(e => setPreview({ status: 'error', message: e.message }))
      return
    }

    fetch(fileUrl)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() })
      .then(text => {
        if (ext === 'csv') {
          const rows = parseCSV(text)
          setPreview({ status: 'csv', headers: rows[0] ?? [], rows: rows.slice(1) })
        } else if (['txt', 'md', 'log', 'json', 'xml'].includes(ext)) {
          setPreview({ status: 'text', content: text })
        } else {
          setPreview({ status: 'unsupported' })
        }
      })
      .catch(e => setPreview({ status: 'error', message: e.message }))
  }, [fileUrl, ext, path])

  useEffect(() => {
    if (!enlarged) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEnlarged(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [enlarged])

  return (
    <div className={`${styles.wrap} ${enlarged ? styles.enlarged : ''}`}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarInfo}>
          <span className={styles.toolbarName}>{filename}</span>
          {description && <span className={styles.toolbarDesc}>{description}</span>}
        </div>
        <div className={styles.toolbarActions}>
          <a href={downloadUrl} download={filename} className={styles.toolbarBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Herunterladen
          </a>
          <button
            className={styles.toolbarBtn}
            onClick={() => setEnlarged(e => !e)}
            title={enlarged ? 'Verkleinern' : 'Vergrößern'}
          >
            {enlarged ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
                <line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            )}
            {enlarged ? 'Verkleinern' : 'Vergrößern'}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {preview.status === 'loading' && (
          <div className={styles.center}><span className={styles.spinner} /></div>
        )}

        {preview.status === 'error' && (
          <div className={styles.center}>
            <p className={styles.muted}>Fehler: {preview.message}</p>
          </div>
        )}

        {preview.status === 'pdf' && (
          <iframe src={fileUrl} className={styles.fill} title={filename} />
        )}

        {preview.status === 'image' && (
          <div className={styles.imageWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl} alt={filename} className={styles.image} />
          </div>
        )}

        {preview.status === 'csv' && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>{preview.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {preview.status === 'eml' && (
          <div className={styles.eml}>
            <table className={styles.emlMeta}>
              <tbody>
                {preview.from    && <tr><td className={styles.emlLabel}>Von</td><td>{preview.from}</td></tr>}
                {preview.to      && <tr><td className={styles.emlLabel}>An</td><td>{preview.to}</td></tr>}
                {preview.cc      && <tr><td className={styles.emlLabel}>CC</td><td>{preview.cc}</td></tr>}
                {preview.date    && <tr><td className={styles.emlLabel}>Datum</td><td>{preview.date}</td></tr>}
                <tr className={styles.emlSubjectRow}>
                  <td className={styles.emlLabel}>Betreff</td>
                  <td><strong>{preview.subject}</strong></td>
                </tr>
              </tbody>
            </table>
            <div className={styles.emlDivider} />
            {preview.isHtml ? (
              <iframe
                srcDoc={preview.body}
                sandbox="allow-same-origin"
                className={styles.emlIframe}
                title="Email body"
              />
            ) : (
              <pre className={styles.emlText}>{preview.body}</pre>
            )}
            {preview.attachments.length > 0 && (
              <>
                <div className={styles.emlDivider} />
                <div className={styles.emlAttachments}>
                  <span className={styles.emlAttTitle}>Anhänge ({preview.attachments.length})</span>
                  {preview.attachments.map(att => (
                    <a
                      key={att.index}
                      href={`/api/eml/attachment?path=${encodeURIComponent(path)}&index=${att.index}`}
                      download={att.filename}
                      className={styles.emlAttachment}
                    >
                      <svg className={styles.emlAttIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                      </svg>
                      <span className={styles.emlAttName}>{att.filename}</span>
                      <span className={styles.emlAttSize}>{formatSize(att.size)}</span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {preview.status === 'text' && (
          <pre className={styles.text}>{preview.content}</pre>
        )}

        {preview.status === 'unsupported' && (
          <div className={styles.center}>
            <p className={styles.muted}>Vorschau für diesen Dateityp nicht verfügbar.</p>
            <a href={downloadUrl} download={filename} className={styles.downloadBtn}>
              Datei herunterladen
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
