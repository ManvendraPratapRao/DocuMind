import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  CheckCircle2, XCircle, Copy, Download,
  ChevronDown, ChevronRight, FileText, Sparkles, ZoomIn, ZoomOut, Maximize2, TableProperties, Code,
  User, Calendar, DollarSign, Building2, Hash, Percent, GripHorizontal, Pencil, Check, Loader2, Save,
  Layers, FileSpreadsheet
} from 'lucide-react'
import DocumentViewer from './viewer/DocumentViewer'
import Papa from 'papaparse'
import axios from 'axios'

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
    <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${cls}`}>
      {pct}%
    </div>
  )
}

function getFieldIcon(key) {
  const k = key.toLowerCase();
  if (k.includes('date')) return <Calendar size={13} className="text-slate-400 shrink-0" />;
  if (k.includes('amount') || k.includes('total') || k.includes('price')) return <DollarSign size={13} className="text-slate-400 shrink-0" />;
  if (k.includes('name') || k.includes('vendor') || k.includes('customer')) return <User size={13} className="text-slate-400 shrink-0" />;
  if (k.includes('company') || k.includes('gstin') || k.includes('address')) return <Building2 size={13} className="text-slate-400 shrink-0" />;
  if (k.includes('tax') || k.includes('rate')) return <Percent size={13} className="text-slate-400 shrink-0" />;
  return <Hash size={13} className="text-slate-400 shrink-0" />;
}

function FieldRow({ label, value, isEditing, onChange }) {
  const [localEditing, setLocalEditing] = useState(false);
  const activeEditing = isEditing || localEditing;

  if (!activeEditing && (value === null || value === undefined || value === '')) return null;

  return (
    <div 
      className={`flex items-center gap-4 py-2.5 border-b border-slate-800/50 last:border-0 px-4 transition-colors rounded-lg group ${activeEditing ? 'bg-slate-800/40' : 'hover:bg-slate-800/20'}`}>
      <div className="flex items-center gap-2.5 w-1/3 min-w-[200px]">
        {getFieldIcon(label)}
        <span className="text-[12px] font-medium capitalize truncate text-slate-300">
          {label.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
        {activeEditing ? (
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              value={value === null || value === undefined ? '' : String(value)}
              onChange={(e) => onChange && onChange(e.target.value)}
              className="flex-1 bg-slate-900 border border-blue-500/50 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/40 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-100 outline-none transition-all shadow-inner"
              placeholder="Enter value..."
            />
            {!isEditing && localEditing && (
              <button
                type="button"
                onClick={() => setLocalEditing(false)}
                className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors shrink-0"
                title="Finish editing this field"
              >
                <Check size={14} />
              </button>
            )}
          </div>
        ) : (
          <div 
            onClick={() => setLocalEditing(true)}
            className="flex items-center justify-between w-full cursor-pointer group/val py-0.5"
            title="Click or use Edit Fields to modify value"
          >
            <span className="text-[13px] font-medium text-slate-100 whitespace-pre-wrap break-words max-h-40 overflow-y-auto block pr-2">
              {String(value)}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover/val:opacity-100 transition-opacity ml-2 shrink-0">
              <Pencil size={12} className="text-amber-400/80 group-hover/val:text-amber-300" />
              <span className="text-[10px] text-slate-500">Edit</span>
            </div>
          </div>
        )}
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

export default function ResultsPanel({ job, filePreviewUrl, uploadedFile, onNewExtraction, onUpdateJob, apiKey, batchId, onBackToBatch }) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('fields') // 'fields', 'table', 'raw', 'json'
  
  // Interactive editing state
  const [resultData, setResultData] = useState(() => job?.result || {})
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [topHeight, setTopHeight] = useState(55) // percentage
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  // Direct webhook export state
  const [isSendingWebhook, setIsSendingWebhook] = useState(false)
  const [webhookSent, setWebhookSent] = useState(false)

  const handleSendToWebhook = async () => {
    const webhookUrl = localStorage.getItem('documind_webhook_url')
    if (!webhookUrl) {
      alert("Please configure your Google Sheets or Webhook URL in the Settings page first.")
      return
    }
    if (!job?.job_id) return
    setIsSendingWebhook(true)
    try {
      const key = apiKey || localStorage.getItem('documind_api_key') || 'documind_demo_access'
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const res = await axios.post(`${API_URL}/async/webhook/send`, {
        url: webhookUrl,
        job_ids: [job.job_id]
      }, {
        headers: { Authorization: `Bearer ${key}` }
      })
      setWebhookSent(true)
      setTimeout(() => setWebhookSent(false), 3000)
    } catch (err) {
      alert("Webhook dispatch failed: " + (err.response?.data?.detail || err.message || 'Unknown error'))
    } finally {
      setIsSendingWebhook(false)
    }
  }

  // Keep local result in sync when switching jobs or when job result changes
  useEffect(() => {
    setResultData(job?.result || {})
    setIsEditing(false)
    setSaveSuccess(false)
  }, [job?.job_id, job?.result])

  const updateFlatField = (key, value) => {
    setResultData(prev => {
      const updated = { ...prev, [key]: value }
      if (job) job.result = updated
      return updated
    })
  }

  const updateNestedListItem = (listKey, itemIndex, fieldKey, value) => {
    setResultData(prev => {
      const list = Array.isArray(prev[listKey]) ? [...prev[listKey]] : []
      if (list[itemIndex]) {
        list[itemIndex] = { ...list[itemIndex], [fieldKey]: value }
      }
      const updated = { ...prev, [listKey]: list }
      if (job) job.result = updated
      return updated
    })
  }

  const updateNestedObjectField = (parentKey, fieldKey, value) => {
    setResultData(prev => {
      const parent = typeof prev[parentKey] === 'object' && prev[parentKey] !== null ? { ...prev[parentKey] } : {}
      parent[fieldKey] = value
      const updated = { ...prev, [parentKey]: parent }
      if (job) job.result = updated
      return updated
    })
  }

  const handleSaveEdits = async () => {
    setIsSaving(true)
    try {
      if (job?.job_id) {
        const key = apiKey || localStorage.getItem('documind_api_key') || 'documind_demo_access'
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        await axios.patch(`${API_URL}/async/jobs/${job.job_id}`, { result: resultData }, {
          headers: { Authorization: `Bearer ${key}` }
        })
      }
      if (onUpdateJob && job?.job_id) {
        onUpdateJob(job.job_id, resultData)
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
      setIsEditing(false)
    } catch (err) {
      console.warn('Failed to persist edit to backend:', err)
      // Even if offline/network issue, keep edits in memory
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(resultData, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(resultData, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `DocuMind_${job?.doc_type || 'extraction'}_${job?.job_id?.slice(0, 6) || 'data'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    if (!resultData) return;

    // Dynamically find any array-of-objects (line items, etc)
    let arrayKey = null;
    let arrayData = null;
    for (const [k, v] of Object.entries(resultData)) {
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
      for (const [k, v] of Object.entries(resultData)) {
        if (SKIP_KEYS.has(k)) continue;  // Skip metadata
        if (k !== arrayKey && (typeof v !== 'object' || v === null)) {
          topLevel[k] = v;
        }
      }
      csvData = arrayData.map(row => ({ ...topLevel, ...row }));
    } else {
      const flatRow = {};
      for (const [k, v] of Object.entries(resultData)) {
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
    a.download = `DocuMind_${job?.doc_type || 'extraction'}_${job?.job_id?.slice(0, 6) || 'data'}.csv`;
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

  if (job?.status === 'failed') {
    return (
      <div className="flex-1 flex items-center justify-center p-8 animate-fade-in h-full bg-[#0a0f1c]">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
            <XCircle size={28} className="text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Extraction Failed</h2>
          <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
            {job?.error || 'An unknown error occurred during extraction.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onNewExtraction}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold rounded-xl transition-all cursor-pointer"
            >
              Try Again
            </button>
            {batchId && onBackToBatch && (
              <button
                onClick={onBackToBatch}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-[13px] font-semibold rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Layers size={14} /> Back to Batch
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const confidence   = resultData.confidence_score ?? job?.result?.confidence_score
  const warnings     = resultData.warnings || resultData.warning || job?.result?.warnings || []
  const rawText      = resultData.raw_text_preview || job?.result?.raw_text_preview || 'No raw text available.'
  const flatEntries  = Object.entries(resultData).filter(([k, v]) =>
    !SKIP_KEYS.has(k) && !Array.isArray(v) && (typeof v !== 'object' || v === null)
  )
  const nestedEntries = Object.entries(resultData).filter(([k, v]) =>
    !SKIP_KEYS.has(k) && (Array.isArray(v) || (typeof v === 'object' && v !== null))
  )

  const isPdf   = uploadedFile?.type === 'application/pdf' || job?.filename?.toLowerCase().endsWith('.pdf')
  const isImage = uploadedFile?.type?.startsWith('image/') || job?.filename?.toLowerCase().match(/\.(jpg|jpeg|png)$/)
  const fileName = uploadedFile?.name || job?.filename

  return (
    <div ref={containerRef} className="flex flex-col h-full animate-fade-in bg-[#0a0f1c] overflow-hidden">

      {/* Batch Navigation Banner (when inspecting a document from a batch) */}
      {batchId && onBackToBatch && (
        <div className="bg-indigo-950/80 border-b border-indigo-500/30 px-6 py-2.5 flex items-center justify-between shrink-0 z-30 shadow-md">
          <div className="flex items-center gap-2.5 text-xs text-indigo-200">
            <div className="w-5 h-5 rounded bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Layers size={12} className="text-indigo-400" />
            </div>
            <span>
              Inspecting document from batch: <span className="font-mono text-indigo-300 font-semibold">{batchId.slice(0, 16)}...</span>
            </span>
          </div>
          <button
            onClick={onBackToBatch}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-950/50 cursor-pointer active:scale-95"
            title="Return to batch queue and download combined exports"
          >
            <Layers size={13} />
            ← Back to Batch Dashboard
          </button>
        </div>
      )}

      {/* Top Half: Document Preview */}
      <div style={{ height: `${topHeight}%` }} className="flex flex-col shrink-0 min-h-[200px]">
        <DocumentViewer 
          filePreviewUrl={filePreviewUrl}
          isPdf={isPdf}
          isImage={isImage}
          fileName={fileName}
        />
      </div>

      {/* Resizer */}
      <div 
        onMouseDown={startResize}
        className={`h-2 -my-1 z-20 cursor-row-resize flex items-center justify-center group relative ${isDragging ? 'bg-indigo-500/20' : 'hover:bg-indigo-500/10'}`}
      >
        <div className={`w-8 h-1 rounded-full transition-colors ${isDragging ? 'bg-indigo-400' : 'bg-slate-700 group-hover:bg-indigo-400'}`} />
      </div>

      {/* Bottom Half: Extraction Results */}
      <div style={{ height: `${100 - topHeight}%` }} className="flex flex-col flex-1 shrink-0 overflow-hidden bg-[#0a0f1c] border-t border-slate-800/80">
        
        {/* Header & Tabs */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[15px] font-bold text-slate-200">Extraction Results</span>
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400">
                {Math.round((confidence || 1) * 100)}% Confidence
              </div>
              {batchId && onBackToBatch && (
                <button
                  onClick={onBackToBatch}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                  title="Return to batch progress"
                >
                  <Layers size={12} />
                  Batch View
                </button>
              )}
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
          
          <div className="flex items-center gap-3">
            {/* Interactive Edit Button */}
            {isEditing ? (
              <button 
                onClick={handleSaveEdits}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[12px] font-bold transition-all shadow-md shadow-emerald-950/40"
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {isSaving ? 'Saving...' : 'Done Editing'}
              </button>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-[12px] font-semibold transition-all shadow-sm"
                title="Edit extracted fields before exporting"
              >
                <Pencil size={12} className="text-amber-400" />
                {saveSuccess ? <span className="text-emerald-400">Saved!</span> : 'Edit Fields'}
              </button>
            )}

            <button onClick={onNewExtraction} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-300 hover:text-white rounded-lg text-[12px] font-medium transition-colors">
              Re-extract <Sparkles size={12} className="text-blue-400" />
            </button>
          </div>
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

              {isEditing && (
                <div className="mb-4 px-4 py-2.5 bg-blue-500/10 border border-blue-500/25 rounded-xl flex items-center justify-between">
                  <span className="text-[12px] text-blue-300 font-medium">
                    ✏️ <strong>Edit Mode Active:</strong> You can edit any field directly below. Changes immediately update JSON and CSV exports.
                  </span>
                  <button
                    onClick={handleSaveEdits}
                    className="text-[11px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 bg-blue-500/20 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Done
                  </button>
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
                        isEditing={isEditing}
                        onChange={(newVal) => updateFlatField(k, newVal)}
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
                                    {Object.entries(item).map(([k, v]) => (
                                      <FieldRow 
                                        key={k} 
                                        label={k} 
                                        value={v}
                                        isEditing={isEditing}
                                        onChange={(newVal) => updateNestedListItem(key, i, k, newVal)}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="px-2 pb-2">
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={item === null || item === undefined ? '' : String(item)}
                                        onChange={(e) => {
                                          const list = [...val]
                                          list[i] = e.target.value
                                          updateFlatField(key, list)
                                        }}
                                        className="w-full bg-slate-900 border border-blue-500/50 rounded px-2.5 py-1 text-[13px] text-slate-100 outline-none"
                                      />
                                    ) : (
                                      <span className="text-[13px] text-slate-300 font-medium">{String(item)}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      ) : typeof val === 'object' && val !== null ? (
                        <div className="flex flex-col mt-2 bg-slate-900/50 rounded-xl border border-slate-700/40 shadow-sm">
                          {Object.entries(val).map(([k, v]) => (
                            <FieldRow 
                              key={k} 
                              label={k} 
                              value={v}
                              isEditing={isEditing}
                              onChange={(newVal) => updateNestedObjectField(key, k, newVal)}
                            />
                          ))}
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
                for (const [k, v] of Object.entries(resultData)) {
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
                            {headers.map(h => (
                              <td 
                                key={h} 
                                className="py-2.5 px-4 border-b border-slate-800/50 text-[13px] font-medium whitespace-nowrap group-last:border-0 text-slate-300 hover:bg-slate-700/30"
                              >
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={row[h] === null || row[h] === undefined ? '' : String(row[h])}
                                    onChange={(e) => updateNestedListItem(arrayKey, i, h, e.target.value)}
                                    className="w-full min-w-[120px] bg-slate-900 border border-slate-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 rounded px-2 py-1 text-[12px] text-slate-100 outline-none transition-all"
                                  />
                                ) : (
                                  <span>{String(row[h] ?? '')}</span>
                                )}
                              </td>
                            ))}
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
                  {JSON.stringify(resultData, null, 2)}
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
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-[12px] font-semibold text-slate-200 transition-all cursor-pointer"
          >
            <TableProperties size={14} />
            Export to CSV
          </button>

          <button
            onClick={handleSendToWebhook}
            disabled={isSendingWebhook}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[12px] font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer ml-auto active:scale-95"
            title="Send extracted data directly to Google Sheets or Webhook"
          >
            {isSendingWebhook ? <Loader2 size={14} className="animate-spin" /> : webhookSent ? <Check size={14} /> : <FileSpreadsheet size={14} />}
            {webhookSent ? 'Synced to Sheets!' : isSendingWebhook ? 'Sending...' : 'Send to Google Sheets'}
          </button>
        </div>
        
      </div>
    </div>
  )
}
