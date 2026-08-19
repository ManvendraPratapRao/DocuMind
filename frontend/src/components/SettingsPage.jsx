import React, { useState, useEffect } from 'react'
import { Settings, CheckCircle2, Webhook, ShieldAlert } from 'lucide-react'

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const savedUrl = localStorage.getItem('documind_webhook_url')
    if (savedUrl) setWebhookUrl(savedUrl)
  }, [])

  const handleSave = () => {
    localStorage.setItem('documind_webhook_url', webhookUrl)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0a0f1c] text-slate-200">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Settings size={20} className="text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
            <p className="text-[13px] text-slate-400">Configure global app settings and integrations.</p>
          </div>
        </div>

        {/* ── Webhooks ── */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
            <Webhook size={16} className="text-slate-400" />
            <h2 className="text-[14px] font-bold text-slate-200">Webhook Integrations</h2>
          </div>
          <div className="p-6">
            <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Google Sheets / Zapier Webhook URL
            </label>
            <div className="flex gap-3">
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[14px] text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-bold rounded-xl transition-all flex items-center gap-2"
              >
                {saved ? <><CheckCircle2 size={16} /> Saved</> : 'Save URL'}
              </button>
            </div>
            <p className="text-[12px] text-slate-500 mt-3 leading-relaxed">
              When you select multiple extractions and click "Send to Webhook", we will POST a JSON payload to this URL. 
              You can connect this to Zapier, Make.com, or your own backend to automatically append rows to Google Sheets.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
