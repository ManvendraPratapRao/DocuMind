import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Settings, CheckCircle2, Webhook, FileSpreadsheet, Play,
  Copy, Check, ExternalLink, ChevronDown, ChevronRight, Zap,
  Loader2, AlertCircle, ArrowRight, ShieldCheck
} from 'lucide-react'

const GOOGLE_APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var postData = JSON.parse(e.postData.contents);
    
    // Support both single document payload and batch arrays
    var items = Array.isArray(postData) ? postData : [postData];

    // Auto-create professional header row on new sheets with Doc ID in Column 1
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Doc ID",
        "Timestamp",
        "Filename",
        "Document Type",
        "Invoice / Doc #",
        "Date",
        "Vendor / Sender",
        "Buyer / Customer",
        "Total Amount",
        "Confidence",
        "Status"
      ]);
      var headerRange = sheet.getRange(1, 1, 1, 11);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0f172a");
      headerRange.setFontColor("#f8fafc");
    }

    // Read all existing rows to index by Doc ID (Guarantees zero duplicates / UPSERT)
    var allRows = sheet.getDataRange().getValues();
    var idRowMap = {};
    for (var r = 1; r < allRows.length; r++) {
      var idVal = String(allRows[r][0] || "").trim();
      if (idVal) {
        idRowMap[idVal] = r + 1; // 1-indexed row number
      }
    }

    var inserted = 0;
    var updated = 0;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var docId = String(item.job_id || item.id || "").trim();
      var d = item.data || item.result || item;
      
      var docNum = d.invoice_number || d.number || d.receipt_number || d.order_number || d.id || "";
      var docDate = d.invoice_date || d.date || d.transaction_date || "";
      var vendor = d.vendor_name || d.store_name || d.sender || d.company_name || d.name || "";
      var buyer = d.buyer_name || d.customer_name || d.recipient || "";
      var total = d.total_amount ? "$" + d.total_amount : (d.total || d.amount || "");
      var conf = item.confidence_score ? Math.round(item.confidence_score * 100) + "%" : "100%";

      var rowValues = [
        docId || "N/A",
        new Date().toLocaleString(),
        item.filename || "Document",
        item.doc_type || "document",
        docNum,
        docDate,
        vendor,
        buyer,
        total,
        conf,
        item.status || "done"
      ];

      // UPSERT Logic: If docId exists, update row in-place; otherwise append new row
      if (docId && idRowMap[docId]) {
        var targetRow = idRowMap[docId];
        sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
        updated++;
      } else {
        sheet.appendRow(rowValues);
        if (docId) idRowMap[docId] = sheet.getLastRow();
        inserted++;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      inserted: inserted,
      updated: updated,
      message: "Processed " + items.length + " item(s) without duplicates."
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
};`

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [autoSingle, setAutoSingle] = useState(true)
  const [autoBatch, setAutoBatch] = useState(true)
  const [saved, setSaved] = useState(false)
  const [copiedScript, setCopiedScript] = useState(false)
  const [guideOpen, setGuideOpen] = useState(true)
  const [payloadOpen, setPayloadOpen] = useState(false)

  // Testing state
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const apiKey = localStorage.getItem('documind_api_key') || 'documind_demo_access'

  useEffect(() => {
    const savedUrl = localStorage.getItem('documind_webhook_url')
    if (savedUrl) setWebhookUrl(savedUrl)

    const savedAutoSingle = localStorage.getItem('documind_auto_webhook_single')
    if (savedAutoSingle !== null) setAutoSingle(savedAutoSingle === 'true')

    const savedAutoBatch = localStorage.getItem('documind_auto_webhook_batch')
    if (savedAutoBatch !== null) setAutoBatch(savedAutoBatch === 'true')
  }, [])

  const handleSave = () => {
    localStorage.setItem('documind_webhook_url', webhookUrl.trim())
    localStorage.setItem('documind_auto_webhook_single', String(autoSingle))
    localStorage.setItem('documind_auto_webhook_batch', String(autoBatch))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE)
    setCopiedScript(true)
    setTimeout(() => setCopiedScript(false), 2500)
  }

  const handleTestWebhook = async () => {
    if (!webhookUrl || !webhookUrl.trim().startsWith('http')) {
      alert('Please enter a valid HTTP or HTTPS webhook URL first.')
      return
    }
    setIsTesting(true)
    setTestResult(null)

    try {
      const res = await axios.post(
        `${API_URL}/async/webhook/test`,
        { url: webhookUrl.trim() },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      )
      setTestResult({
        success: true,
        statusCode: res.data.status_code,
        latencyMs: res.data.latency_ms,
        message: 'Connected successfully! Received 200 OK response from destination.'
      })
    } catch (err) {
      setTestResult({
        success: false,
        statusCode: err.response?.status || 0,
        message: err.response?.data?.detail || err.message || 'Failed to reach webhook URL'
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0a0f1c] text-slate-200">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <FileSpreadsheet size={24} className="text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">Integrations & Webhooks</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Google Sheets Ready
                </span>
              </div>
              <p className="text-[13px] text-slate-400 mt-0.5">
                Automatically export extracted data to Google Sheets, Zapier, Make.com, or your own backend.
              </p>
            </div>
          </div>
        </div>

        {/* ── Webhook Configuration Card ── */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center gap-2.5">
              <Webhook size={18} className="text-blue-400" />
              <h2 className="text-[15px] font-bold text-slate-100">Webhook Destination</h2>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck size={14} className="text-emerald-400" />
              Direct Backend Relay (No CORS limits)
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-[12px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Google Sheets / Webhook URL
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => {
                    setWebhookUrl(e.target.value)
                    setTestResult(null)
                  }}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec or Zapier catch hook"
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-[13px] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                />
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={isTesting || !webhookUrl}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700/90 text-slate-200 text-[13px] font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Send a sample test payload to verify connection"
                >
                  {isTesting ? <Loader2 size={15} className="animate-spin text-indigo-400" /> : <Play size={14} className="text-emerald-400" />}
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[13px] font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  {saved ? <><CheckCircle2 size={16} /> Saved!</> : 'Save Settings'}
                </button>
              </div>

              {/* Developer /dev Warning */}
              {webhookUrl.includes('/dev') && (
                <div className="mt-2.5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-[12px] text-amber-300">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <span className="font-bold">Test / Developer URL detected (/dev):</span> Google requires personal account sign-in for <code className="bg-amber-950/80 px-1.5 py-0.5 rounded text-amber-200">/dev</code> URLs, causing a <strong>401 Unauthorized</strong> error.
                    <br />
                    To fix: In your Apps Script editor, click <strong>Deploy</strong> → <strong>New deployment</strong> → select <strong>Web app</strong> → set <strong>Who has access: Anyone</strong>, then copy the URL that ends in <code className="bg-amber-950/80 px-1.5 py-0.5 rounded text-emerald-300">/exec</code>.
                  </div>
                </div>
              )}

              {/* Test Result Pill */}
              {testResult && (
                <div className={`mt-3 p-3 rounded-xl border flex items-center gap-2.5 text-[12px] ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/20 text-red-300'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className="font-bold">
                      {testResult.success ? `Connected! Status 200 OK (${testResult.latencyMs}ms)` : 'Connection Failed'}
                    </span>
                    <span className="ml-2 text-slate-400">{testResult.message}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Automated Dispatch Checkboxes */}
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Automated Event Triggers</p>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={autoSingle}
                  onChange={e => setAutoSingle(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[13px] text-slate-300 group-hover:text-white transition-colors">
                  Automatically sync <strong>single document extractions</strong> to Google Sheets upon completion
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={autoBatch}
                  onChange={e => setAutoBatch(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[13px] text-slate-300 group-hover:text-white transition-colors">
                  Automatically sync each document in <strong>batch extractions</strong> to Google Sheets as it completes
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Google Sheets Setup Walkthrough ── */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setGuideOpen(!guideOpen)}
            className="w-full px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 text-left cursor-pointer hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Zap size={18} className="text-amber-400" />
              <div>
                <h2 className="text-[15px] font-bold text-slate-100">Google Sheets Quick Setup Guide (3 Steps)</h2>
                <p className="text-[11px] text-slate-400">Takes under 60 seconds with 100% free Google Apps Script</p>
              </div>
            </div>
            {guideOpen ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </button>

          {guideOpen && (
            <div className="p-6 space-y-6 text-[13px] leading-relaxed text-slate-300">
              
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/30">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Open any Google Sheet and create a script</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Open <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-300 inline-flex items-center gap-0.5">sheets.new <ExternalLink size={10} /></a> in your browser. In the top menu, click <strong>Extensions</strong> → <strong>Apps Script</strong>.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-indigo-500/30">
                  2
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-200">Paste the DocuMind Google Apps Script</p>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
                    >
                      {copiedScript ? <><Check size={13} /> Copied to Clipboard!</> : <><Copy size={13} /> Copy Google Script</>}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <ShieldCheck size={11} /> Zero-Duplicate Protection (UPSERT)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Re-exporting or multiple clicks update the same row in-place without duplicating.
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mb-3">
                    Delete any existing code in the Apps Script editor and paste this code:
                  </p>
                  <div className="relative">
                    <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56">
                      {GOOGLE_APPS_SCRIPT_TEMPLATE}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                  3
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Deploy as a Web App & Copy URL</p>
                  <ol className="list-disc list-inside text-slate-400 text-xs space-y-1 mt-1 pl-1">
                    <li>Click the blue <strong>Deploy</strong> button (top right) → <strong>New deployment</strong>.</li>
                    <li>Click the ⚙️ gear icon next to "Select type" and select <strong>Web app</strong>.</li>
                    <li>Set <strong>Execute as:</strong> <span className="text-slate-200 font-medium">Me (your email)</span>.</li>
                    <li>Set <strong>Who has access:</strong> <span className="text-emerald-400 font-semibold">Anyone</span> (this allows DocuMind to POST rows).</li>
                    <li>Click <strong>Deploy</strong>, copy the resulting <strong>Web app URL</strong> (ends in <code className="text-indigo-300">/exec</code>), and paste it above!</li>
                  </ol>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ── JSON Payload Preview ── */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setPayloadOpen(!payloadOpen)}
            className="w-full px-6 py-3.5 flex items-center justify-between text-left text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
          >
            <span>Payload Structure Preview</span>
            {payloadOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {payloadOpen && (
            <div className="p-4 bg-slate-950 border-t border-slate-800/80">
              <pre className="text-[11px] font-mono text-slate-400 leading-relaxed overflow-x-auto">
{`{
  "event": "extraction.completed",
  "job_id": "71194577-f116-491b-80a1-a496c1b3f71c",
  "batch_id": "batch_8a2d10e5",
  "filename": "INV-2024-001.pdf",
  "doc_type": "invoice",
  "status": "done",
  "confidence_score": 0.95,
  "data": {
    "invoice_number": "INV-2023-08942",
    "invoice_date": "2023-10-15",
    "vendor_name": "Acme Industrial Supplies Co.",
    "buyer_name": "Global Tech Solutions Ltd.",
    "total_amount": 2821.00
  }
}`}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
