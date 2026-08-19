import { LayoutTemplate, Plus } from 'lucide-react'

export default function TemplatesPage() {
  return (
    <div className="flex-1 p-8 bg-[#0B0F19] overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight mb-1.5">Templates</h1>
          <p className="text-[13px] text-slate-400">Manage extraction templates for standard document layouts.</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[13px] font-semibold transition-all">
          <Plus size={16} /> New Template
        </button>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
        <LayoutTemplate size={48} className="mb-4 opacity-50" />
        <h3 className="text-sm font-semibold text-slate-300 mb-1">No templates yet</h3>
        <p className="text-[12px]">Create your first template to get started.</p>
      </div>
    </div>
  )
}
