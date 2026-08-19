import { useState } from 'react'
import { Database, Key, CheckCircle2, ChevronRight, Zap, Plus, X } from 'lucide-react'

export default function ApiModelsPage({ apiKey, setApiKey, models, setModels, defaultModel, setDefaultModel }) {
  const [keyInput, setKeyInput] = useState(apiKey)
  const [saved, setSaved] = useState(false)
  
  // Custom Model Form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newModelId, setNewModelId] = useState('')
  const [newModelLabel, setNewModelLabel] = useState('')

  const handleSave = () => {
    setApiKey(keyInput)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAddModel = () => {
    if (!newModelId.trim() || !newModelLabel.trim()) return
    const newModel = {
      value: newModelId.trim(),
      label: newModelLabel.trim(),
      badge: 'Custom',
      desc: 'User added model',
      badgeColor: 'emerald'
    }
    setModels([...models, newModel])
    setNewModelId('')
    setNewModelLabel('')
    setShowAddForm(false)
  }

  const handleRemoveModel = (val) => {
    setModels(models.filter(m => m.value !== val))
    if (defaultModel === val) setDefaultModel(models[0]?.value || '')
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0a0f1c] text-slate-200">
      <div className="max-w-3xl mx-auto">
        
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Database size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">API & Models</h1>
            <p className="text-[13px] text-slate-400">Configure your access key and manage AI models.</p>
          </div>
        </div>

        {/* ── API Configuration ── */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
            <Key size={16} className="text-slate-400" />
            <h2 className="text-[14px] font-bold text-slate-200">DocuMind API Access</h2>
          </div>
          <div className="p-6">
            <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Secret Key
            </label>
            <div className="flex gap-3">
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="gsk_..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[14px] text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-bold rounded-xl transition-all flex items-center gap-2"
              >
                {saved ? <><CheckCircle2 size={16} /> Saved</> : 'Save Key'}
              </button>
            </div>
            <p className="text-[12px] text-slate-500 mt-3">
              This is the <b>API_SECRET_KEY</b> from your backend .env file. It secures your DocuMind instance.
            </p>
          </div>
        </div>

        {/* ── Model Management ── */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-slate-400" />
              <h2 className="text-[14px] font-bold text-slate-200">Model Selection</h2>
            </div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 text-[12px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus size={14} /> Add Model
            </button>
          </div>
          <div className="p-6">
            
            {showAddForm && (
              <div className="mb-6 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Model ID (e.g. llama-3.1-8b-instant)</label>
                  <input
                    type="text"
                    value={newModelId}
                    onChange={e => setNewModelId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={newModelLabel}
                    onChange={e => setNewModelLabel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button 
                  onClick={handleAddModel}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-bold rounded-lg transition-all h-[38px]"
                >
                  Add
                </button>
              </div>
            )}

            <label className="block text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Available Models
            </label>
            <div className="space-y-2">
              {models.map(m => (
                <div 
                  key={m.value} 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer
                    ${defaultModel === m.value ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}
                  `}
                  onClick={() => setDefaultModel(m.value)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                      ${defaultModel === m.value ? 'border-blue-500' : 'border-slate-600'}
                    `}>
                      {defaultModel === m.value && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-200">{m.label}</p>
                      <p className="text-[12px] text-slate-500">{m.value}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">
                      {m.badge}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRemoveModel(m.value); }}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-slate-500 mt-4">
              Select a model above to set it as your default for all new extractions.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
