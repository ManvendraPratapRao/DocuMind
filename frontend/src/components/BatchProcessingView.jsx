import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  FileText,
  Layers,
  Loader2,
  ExternalLink,
  X,
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react'

export default function BatchProcessingView({
  batchId,
  apiUrl,
  apiKey,
  onClose,
  onInspectJob,
  onRefreshJobs
}) {
  const [batchData, setBatchData] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isSyncingWebhook, setIsSyncingWebhook] = useState(false)
  const [webhookSyncSuccess, setWebhookSyncSuccess] = useState(false)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  const fetchBatchStatus = async () => {
    try {
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      const res = await axios.get(`${apiUrl}/async/batch/${batchId}`, { headers })
      setBatchData(res.data)

      // When all finished, refresh sidebar jobs list
      if (res.data.status === 'completed' && onRefreshJobs) {
        onRefreshJobs()
      }
    } catch (err) {
      console.error('Failed to poll batch status:', err)
      setError('Failed to fetch batch progress.')
    }
  }

  useEffect(() => {
    fetchBatchStatus()
    timerRef.current = setInterval(() => {
      fetchBatchStatus()
    }, 1500)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [batchId])

  // Stop polling once batch is completed
  useEffect(() => {
    if (batchData && batchData.status === 'completed' && timerRef.current) {
      clearInterval(timerRef.current)
    }
  }, [batchData?.status])

  const handleDownloadCsv = async () => {
    setIsExporting(true)
    try {
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      const res = await axios.get(`${apiUrl}/async/batch/${batchId}/export-csv`, {
        headers,
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `batch_${batchId.slice(0, 8)}_export.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV export failed:', err)
      alert('Could not export CSV. Make sure at least one extraction succeeded.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadJson = () => {
    if (!batchData || !batchData.jobs) return
    const completedResults = batchData.jobs
      .filter(j => j.status === 'done' && j.result)
      .map(j => ({
        filename: j.filename,
        doc_type: j.doc_type,
        data: j.result
      }))

    const blob = new Blob([JSON.stringify(completedResults, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `batch_${batchId.slice(0, 8)}_export.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSyncToWebhook = async () => {
    const webhookUrl = localStorage.getItem('documind_webhook_url')
    if (!webhookUrl) {
      alert("Please configure your Google Sheets or Webhook URL in Settings first.")
      return
    }
    const completedJobIds = (batchData?.jobs || []).filter(j => j.status === 'done').map(j => j.job_id)
    if (completedJobIds.length === 0) {
      alert("No completed extractions to sync yet.")
      return
    }

    setIsSyncingWebhook(true)
    try {
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      const res = await axios.post(`${apiUrl}/async/webhook/send`, {
        url: webhookUrl,
        job_ids: completedJobIds
      }, { headers })
      setWebhookSyncSuccess(true)
      setTimeout(() => setWebhookSyncSuccess(false), 3000)
    } catch (err) {
      alert("Webhook sync failed: " + (err.response?.data?.detail || err.message || 'Unknown error'))
    } finally {
      setIsSyncingWebhook(false)
    }
  }

  const isCompleted = batchData?.status === 'completed'
  const percent = batchData?.percent_complete || 0

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1c] text-slate-200 overflow-hidden">
      {/* ── Top Bar ── */}
      <div className="px-8 py-5 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Layers size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">Batch Extraction Dashboard</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 border border-blue-500/25 text-blue-400 font-mono">
                #{batchId.slice(0, 8)}
              </span>
            </div>
            <p className="text-[12px] text-slate-400">
              {batchData ? `${batchData.total} documents queued for automated AI extraction` : 'Initializing batch...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Export CSV Button */}
          <button
            onClick={handleDownloadCsv}
            disabled={!batchData || batchData.completed === 0 || isExporting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-[12px] font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
          >
            {isExporting ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            <span>Download Combined CSV</span>
          </button>

          {/* Sync to Webhook Button */}
          <button
            onClick={handleSyncToWebhook}
            disabled={!batchData || batchData.completed === 0 || isSyncingWebhook}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-[12px] font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-950/30"
            title="Push completed batch documents directly into Google Sheets"
          >
            {isSyncingWebhook ? <Loader2 size={14} className="animate-spin" /> : webhookSyncSuccess ? <CheckCircle2 size={14} /> : <FileSpreadsheet size={14} />}
            <span>{webhookSyncSuccess ? 'Synced to Sheets!' : 'Sync to Sheets'}</span>
          </button>

          {/* Export JSON Button */}
          <button
            onClick={handleDownloadJson}
            disabled={!batchData || batchData.completed === 0}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-[12px] font-medium rounded-xl border border-slate-700/60 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download size={14} />
            <span>JSON</span>
          </button>

          {/* Close / Return Button */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Back to single extractor"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Main Scroll Area ── */}
      <div className="flex-1 overflow-y-auto p-8 max-w-5xl w-full mx-auto space-y-6">
        {/* Progress Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-slate-300 uppercase tracking-wider">Overall Progress</span>
              {isCompleted ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Completed
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Extracting
                </span>
              )}
            </div>
            <span className="text-2xl font-black text-white font-mono">{percent}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50 mb-4">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isCompleted
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-500'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-4 gap-4 pt-2 border-t border-slate-800/60">
            <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/50">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Total Files</p>
              <p className="text-xl font-bold text-white mt-0.5">{batchData?.total || 0}</p>
            </div>
            <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/50">
              <p className="text-[11px] font-bold text-emerald-500 uppercase">Completed</p>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{batchData?.completed || 0}</p>
            </div>
            <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/50">
              <p className="text-[11px] font-bold text-amber-500 uppercase">In Queue</p>
              <p className="text-xl font-bold text-amber-400 mt-0.5">{batchData?.pending || 0}</p>
            </div>
            <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/50">
              <p className="text-[11px] font-bold text-red-500 uppercase">Failed</p>
              <p className="text-xl font-bold text-red-400 mt-0.5">{batchData?.failed || 0}</p>
            </div>
          </div>
        </div>

        {/* ── Document Item List ── */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-slate-300 uppercase tracking-wider">Document Queue</h2>
            <span className="text-[11px] text-slate-500 font-medium">Click any row to inspect extracted data</span>
          </div>

          <div className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto">
            {(!batchData?.jobs || batchData.jobs.length === 0) ? (
              <div className="p-8 text-center text-slate-500 text-[13px]">
                Loading documents...
              </div>
            ) : (
              batchData.jobs.map((j, idx) => {
                const isDone = j.status === 'done'
                const isFail = j.status === 'failed'
                const isProc = j.status === 'processing'
                const isPending = j.status === 'pending'

                // Extract summary data preview if available
                let summaryInfo = ''
                if (isDone && j.result) {
                  const vendor = j.result.vendor_name || j.result.store_name || j.result.name || j.result.sender
                  const total = j.result.total_amount ? `$${j.result.total_amount}` : ''
                  summaryInfo = [vendor, total].filter(Boolean).join(' · ')
                }

                return (
                  <div
                    key={j.job_id || idx}
                    onClick={() => onInspectJob && onInspectJob(j)}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 pr-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isDone ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        isFail ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        isProc ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                        'bg-slate-800 border-slate-700 text-slate-500'
                      }`}>
                        {isProc ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                            {j.filename}
                          </p>
                          <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
                            {j.doc_type}
                          </span>
                        </div>
                        {summaryInfo && (
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
                            {summaryInfo}
                          </p>
                        )}
                        {isFail && j.error && (
                          <p className="text-[11px] text-red-400 mt-0.5 truncate">
                            {j.error}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Confidence pill */}
                      {isDone && j.result?.confidence_score && (
                        <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          {Math.round(j.result.confidence_score * 100)}%
                        </span>
                      )}

                      {/* Status Pill */}
                      {isDone && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 size={12} /> Done
                        </span>
                      )}
                      {isProc && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full animate-pulse">
                          <Loader2 size={12} className="animate-spin" /> Processing
                        </span>
                      )}
                      {isPending && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full">
                          <Clock size={12} /> Queued
                        </span>
                      )}
                      {isFail && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                          <AlertCircle size={12} /> Failed
                        </span>
                      )}

                      <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
