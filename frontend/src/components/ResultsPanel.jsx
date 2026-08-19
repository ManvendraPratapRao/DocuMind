import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  CheckCircle2, XCircle, Copy, Download,
  ChevronDown, ChevronRight, FileText, Sparkles, ZoomIn, ZoomOut, Maximize2, TableProperties, Code,
  User, Calendar, DollarSign, Building2, Hash, Percent, GripHorizontal
} from 'lucide-react'
import DocumentViewer from './viewer/DocumentViewer'
import Papa from 'papaparse'

function ConfidenceBadge({ score }) {
  if (score === undefined || score === null) return null
  const pct   = Math.round(score * 100)
  const color = pct >= 80 ? 'emerald' : pct >= 55 ? 'yellow' : 'red'
  const cls   = {
    emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
    yellow:  'bg-yellow-500/10  border-yellow-500/25  text-yellow-300',
    red:     'bg-red-500/10     border-red-500/25      text-red-300',
  }[color]
  return (
    <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${cls}`}>
      {pct}%
    </div>
  )
}

function getFieldIcon(key) {
  const k = key.toLowerCase();
  if (k.includes('date')) return <Calendar size={13} className="text-slate-400" />;
  if (k.includes('amount') || k.includes('total') || k.includes('price')) return <DollarSign size={13} className="text-slate-400" />;
  if (k.includes('name') || k.includes('vendor') || k.includes('customer')) return <User size={13} className="text-slate-400" />;
  if (k.includes('company') || k.includes('gstin') || k.includes('address')) return <Building2 size={13} className="text-slate-400" />;
  if (k.includes('tax') || k.includes('rate')) return <Percent size={13} className="text-slate-400" />;
  return <Hash size={13} className="text-slate-400" />;
}

function FieldRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div 
      className="flex items-center gap-4 py-3 border-b border-slate-800/50 last:border-0 px-4 transition-colors rounded-lg group hover:bg-slate-800/20">
      <div className="flex items-center gap-2.5 w-1/3 min-w-[200px]">
        {getFieldIcon(label)}
        <span className="text-[12px] font-medium capitalize truncate text-slate-300">
          {label.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
        <span className="text-[13px] font-medium text-slate-100 whitespace-pre-wrap break-words max-h-40 overflow-y-auto block w-full pr-2">
          {String(value)}
        </span>
      </div>
    </div>
  )
}

function CollapsibleSection({ label, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-slate-700/50 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-800/40 hover:bg-slate-800/60 transition-colors text-left"
      >
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          {label.replace(/_/g, ' ')}
        </span>
        {open
          ? <ChevronDown  size={14} className="text-slate-500 shrink-0" />
          : <ChevronRight size={14} className="text-slate-500 shrink-0" />
        }
      </button>
      {open && <div className="p-1">{children}</div>}
    </div>
  )
}

// Keys from the backend result that are metadata, not user data fields
const SKIP_KEYS = new Set(['status', 'confidence_score', 'warnings', 'warning', 'raw_text_preview'])

export default function ResultsPanel({ job, filePreviewUrl, uploadedFile, onNewExtraction }) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('fields') // 'fields', 'table', 'raw', 'json'
  
  const [topHeight, setTopHeight] = useState(55) // percentage
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(job.result, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(job.result, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `DocuMind_${job.doc_type}_${job.job_id?.slice(0, 6)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    if (!job.result) return;

    // Dynamically find any array-of-objects (line items, etc)
    let arrayKey = null;
    let arrayData = null;
    for (const [k, v] of Object.entries(job.result)) {
      if (SKIP_KEYS.has(k)) continue;  // Skip metadata
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        arrayKey = k;
        arrayData = v;
        break;
      }
    }

    let csvData = [];
    if (arrayData) {
      const topLevel = {};
      for (const [k, v] of Object.entries(job.result)) {
        if (SKIP_KEYS.has(k)) continue;  // Skip metadata
        if (k !== arrayKey && (typeof v !== 'object' || v === null)) {
          topLevel[k] = v;
        }
      }
      csvData = arrayData.map(row => ({ ...topLevel, ...row }));
    } else {
      const flatRow = {};
      for (const [k, v] of Object.entries(job.result)) {
        if (SKIP_KEYS.has(k)) continue;  // Skip metadata
        if (typeof v !== 'object' || v === null) flatRow[k] = v;
        else if (!Array.isArray(v)) flatRow[k] = JSON.stringify(v);
      }
      csvData = [flatRow];
    }

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DocuMind_${job.doc_type}_${job.job_id?.slice(0, 6)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const startResize = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newHeight = ((e.clientY - rect.top) / rect.height) * 100
      if (newHeight >= 20 && newHeight <= 80) {
        setTopHeight(newHeight)
      }
    }

    const handleMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  if (job.status === 'failed') {
    return (
      <div className="flex-1 flex items-center justify-center p-8 animate-fade-in h-full bg-[#0a0f1c]">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
            <XCircle size={28} className="text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Extraction Failed</h2>
          <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
            {job.error || 'An unknown error occurred during extraction.'}
          </p>
          <button
            onClick={onNewExtraction}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold rounded-xl transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const result       = job.result || {}
  const confidence   = result.confidence_score
  const warnings     = result.warnings || result.warning || []
  const rawText      = result.raw_text_preview || 'No raw text available.'
  const flatEntries  = Object.entries(result).filter(([k, v]) =>
    !SKIP_KEYS.has(k) && !Array.isArray(v) && (typeof v !== 'object' || v === null)
  )
  const nestedEntries = Object.entries(result).filter(([k, v]) =>
    !SKIP_KEYS.has(k) && (Array.isArray(v) || (typeof v === 'object' && v !== null))
  )

  const isPdf   = uploadedFile?.type === 'application/pdf' || job.filename?.toLowerCase().endsWith('.pdf')
  const isImage = uploadedFile?.type?.startsWith('image/') || job.filename?.toLowerCase().match(/\.(jpg|jpeg|png)$/)
  const fileName = uploadedFile?.name || job.filename

  return (
    <div ref={containerRef} className="flex flex-col h-full animate-fade-in bg-[#0a0f1c] overflow-hidden">

      {/* ── Top Half: Document Preview ── */}
      <div style={{ height: `${topHeight}%` }} className="flex flex-col shrink-0 min-h-[200px]">
        <DocumentViewer 
          filePreviewUrl={filePreviewUrl}
          isPdf={isPdf}
          isImage={isImage}
          fileName={fileName}
        />
      </div>

      {/* ── Resizer ── */}
      <div 
        onMouseDown={startResize}
        className={`h-2 -my-1 z-20 cursor-row-resize flex items-center justify-center group relative ${isDragging ? 'bg-indigo-500/20' : 'hover:bg-indigo-500/10'}`}
      >
        <div className={`w-8 h-1 rounded-full transition-colors ${isDragging ? 'bg-indigo-400' : 'bg-slate-700 group-hover:bg-indigo-400'}`} />
      </div>

      {/* ── Bottom Half: Extraction Results ── */}
      <div style={{ height: `${100 - topHeight}%` }} className="flex flex-col flex-1 shrink-0 overflow-hidden bg-[#0a0f1c] border-t border-slate-800/80">
        
        {/* Header & Tabs */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[15px] font-bold text-slate-200">Extraction Results</span>
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400">
                {Math.round((confidence || 1) * 100)}% Confidence
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center bg-slate-900/80 rounded-lg p-0.5 border border-slate-800">
              {['fields', 'table', 'raw', 'json'].map((t) => (
                <button 
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all capitalize ${activeTab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                >
                  {t === 'raw' ? 'Raw Text' : t}
                </button>
              ))}
            </div>
          </div>
          
          <button onClick={onNewExtraction} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-300 hover:text-white rounded-lg text-[12px] font-medium transition-colors">
            Re-extract <Sparkles size={12} className="text-blue-400" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-[#0a0f1c]">
          {activeTab === 'fields' && (
            <div className="p-6 max-w-4xl mx-auto">
              {warnings.length > 0 && (
                <div className="mb-6 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <p className="text-[12px] font-medium text-yellow-400">
                    ⚠ {warnings[0]} {warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}
                  </p>
                </div>
              )}

              <div className="bg-[#111726] border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
                {/* Flat fields */}
                {flatEntries.length > 0 && (
                  <div className="flex flex-col p-2">
                    {flatEntries.map(([k, v]) => (
                      <FieldRow 
                        key={k} 
                        label={k} 
                        value={v} 
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Nested sections */}
              {nestedEntries.length > 0 && (
                <div className="mt-6 space-y-4">
                  {nestedEntries.map(([key, val]) => (
                    <CollapsibleSection key={key} label={key}>
                      {Array.isArray(val) ? (
                        val.length === 0 ? (
                          <p className="text-xs text-slate-600 italic px-2 py-4">Empty list</p>
                        ) : (
                          <div className="space-y-3 mt-2">
                            {val.map((item, i) => (
                              <div key={i} className="p-2 bg-slate-900/50 rounded-xl border border-slate-700/40 shadow-sm">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-1">
                                  Item {i + 1}
                                </p>
                                {typeof item === 'object' && item !== null ? (
                                  <div className="flex flex-col">
                                    {Object.entries(item).map(([k, v]) => {
                                      return (
                                        <FieldRow 
                                          key={k} 
                                          label={k} 
                                          value={v} 
                                        />
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className="px-2 pb-2"><span className="text-[13px] text-slate-300 font-medium">{String(item)}</span></div>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      ) : typeof val === 'object' ? (
                        <div className="flex flex-col mt-2 bg-slate-900/50 rounded-xl border border-slate-700/40 shadow-sm">
                          {Object.entries(val).map(([k, v]) => {
                            return (
                              <FieldRow 
                                key={k} 
                                label={k} 
                                value={v} 
                              />
                            )
                          })}
                        </div>
                      ) : null}
                    </CollapsibleSection>
                  ))}
                </div>
              )}

              {flatEntries.length === 0 && nestedEntries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                  <Sparkles size={32} strokeWidth={1.2} className="mb-3" />
                  <p className="text-[14px]">No structured fields returned.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'table' && (
            <div className="p-6">
              {(() => {
                let tableData = null;
                let arrayKey = null;
                for (const [k, v] of Object.entries(result)) {
                  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
                    tableData = v;
                    arrayKey = k;
                    break;
                  }
                }
                if (!tableData) {
                  return <div className="text-slate-500 text-[13px] flex items-center justify-center h-full pt-12">No tabular data found in extraction.</div>
                }
                const headers = Object.keys(tableData[0]);
                return (
                  <div className="overflow-x-auto bg-[#111726] border border-slate-800/80 rounded-xl shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-700">
                          {headers.map(h => (
                            <th key={h} className="py-3 px-4 font-bold text-[11px] text-slate-400 uppercase tracking-widest whitespace-nowrap">
                              {h.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                            {headers.map(h => {
                              return (
                                <td 
                                  key={h} 
                                  className="py-3 px-4 border-b border-slate-800/50 text-[13px] font-medium whitespace-nowrap group-last:border-0 text-slate-300 hover:bg-slate-700/50"
                                >
                                  {String(row[h] ?? '')}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="p-6 h-full">
              <div className="bg-[#111726] border border-slate-800/80 rounded-xl h-full p-4 overflow-auto shadow-sm">
                <pre className="text-[13px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {rawText}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="p-6 h-full">
              <div className="bg-[#0d121f] border border-slate-800/80 rounded-xl h-full p-4 overflow-auto shadow-sm">
                <pre className="text-[13px] font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 px-6 py-3 border-t border-slate-800/80 bg-[#0d1323] shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-[12px] font-semibold text-slate-200 transition-all"
          >
            <Copy size={14} />
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button
            onClick={handleDownloadJSON}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-[12px] font-semibold text-slate-200 transition-all"
          >
            <Download size={14} />
            Download JSON
          </button>
          
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-[12px] font-semibold text-slate-200 transition-all ml-auto"
          >
            <TableProperties size={14} />
            Export to CSV
          </button>
        </div>
        
      </div>
    </div>
  )
}
