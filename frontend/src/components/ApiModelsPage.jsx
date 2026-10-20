import { useState } from 'react'
import { Zap, Plus, X, Info } from 'lucide-react'

const MODEL_INFO = {
  'openai/gpt-oss-120b': {
    desc: 'Highest accuracy for complex documents with many fields, tables, and edge cases.',
    strengths: ['Invoices', 'Purchase Orders', 'Bank Statements'],
    speed: 'Moderate',
    accuracy: 'Excellent',
  },
  'openai/gpt-oss-20b': {
    desc: 'Fast and efficient for straightforward extractions. Great for high-volume use.',
    strengths: ['Receipts', 'Emails', 'Simple Forms'],
    speed: 'Fast',
    accuracy: 'Very Good',
  },
  'qwen/qwen3.8-27b': {
    desc: 'Specialised for numerical data — ideal for documents heavy with numbers and tables.',
    strengths: ['Medical Bills', 'Financial Reports', 'Spreadsheet exports'],
    speed: 'Fast',
    accuracy: 'Very Good',
  },
}

export default function ApiModelsPage({ models, setModels, defaultModel, setDefaultModel }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newModelId, setNewModelId] = useState('')
  const [newModelLabel, setNewModelLabel] = useState('')
  const [hoveredModel, setHoveredModel] = useState(null)

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
    if (defaultModel === val) setDefaultModel(models.find(m => m.value !== val)?.value || '')
  }

  const BADGE_COLORS = {
    blue:    'bg-blue-500/15 text-blue-400 border border-blue-500/20',
    emerald: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    purple:  'bg-purple-500/15 text-purple-400 border border-purple-500/20',
    orange:  'bg-orange-500/15 text-orange-400 border border-orange-500/20',
  }

  const active = hoveredModel || defaultModel
  const activeInfo = MODEL_INFO[active]

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0a0f1c] text-slate-200">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Zap size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">AI Models</h1>
            <p className="text-[13px] text-slate-400">Choose the AI model used for document extraction.</p>
          </div>
        </div>

        {/* Model picker */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-slate-400" />
              <h2 className="text-[14px] font-bold text-slate-200">Select Default Model</h2>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 text-[12px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus size={14} /> Add Custom
            </button>
          </div>

          <div className="p-5">
            {showAddForm && (
              <div className="mb-5 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Model ID (exact Groq model name)</label>
                  <input
                    type="text"
                    value={newModelId}
                    onChange={e => setNewModelId(e.target.value)}
                    placeholder="e.g. llama-3.1-8b-instant"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={newModelLabel}
                    onChange={e => setNewModelLabel(e.target.value)}
                    placeholder="e.g. Llama 3.1 8B"
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

            <div className="space-y-2">
              {models.map(m => (
                <div
                  key={m.value}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer group
                    ${defaultModel === m.value
                      ? 'bg-blue-500/10 border-blue-500/30 shadow-sm shadow-blue-500/10'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/40'
                    }`}
                  onClick={() => setDefaultModel(m.value)}
                  onMouseEnter={() => setHoveredModel(m.value)}
                  onMouseLeave={() => setHoveredModel(null)}
                >
                  <div className="flex items-center gap-3">
                    {/* Radio dot */}
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                      ${defaultModel === m.value ? 'border-blue-500' : 'border-slate-600 group-hover:border-slate-500'}`}
                    >
                      {defaultModel === m.value && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-200">{m.label}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{m.value}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${BADGE_COLORS[m.badgeColor] || BADGE_COLORS.emerald}`}>
                      {m.badge}
                    </span>
                    {models.length > 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); handleRemoveModel(m.value) }}
                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contextual model info card — updates on hover/selection */}
        {activeInfo && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex gap-4 animate-fade-in">
            <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-slate-200 mb-1">
                {models.find(m => m.value === active)?.label}
              </p>
              <p className="text-[12px] text-slate-400 leading-relaxed mb-3">{activeInfo.desc}</p>
              <div className="flex flex-wrap gap-4 text-[11px]">
                <div>
                  <span className="text-slate-500 font-medium uppercase tracking-wider">Best For</span>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {activeInfo.strengths.map(s => (
                      <span key={s} className="px-2 py-0.5 bg-slate-800 rounded-md text-slate-300 font-medium">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium uppercase tracking-wider">Speed</span>
                  <p className="text-slate-300 font-medium mt-1">{activeInfo.speed}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium uppercase tracking-wider">Accuracy</span>
                  <p className="text-slate-300 font-medium mt-1">{activeInfo.accuracy}</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
