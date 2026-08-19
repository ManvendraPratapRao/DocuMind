import { LifeBuoy, FileText, Code, Settings, Sparkles } from 'lucide-react'

export default function HelpPage() {
  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0a0f1c] text-slate-200">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <LifeBuoy size={20} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Help & Documentation</h1>
            <p className="text-[13px] text-slate-400">Learn how to get the most out of DocuMind AI.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
              <Sparkles size={16} className="text-blue-400" />
            </div>
            <h3 className="text-[14px] font-bold text-slate-200 mb-2">Getting Started</h3>
            <p className="text-[13px] text-slate-400 leading-relaxed">
              Upload any PDF or Image on the Extractions page. Select the document type, choose your AI model, and hit extract. DocuMind handles the OCR and data structuring automatically.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4">
              <Code size={16} className="text-indigo-400" />
            </div>
            <h3 className="text-[14px] font-bold text-slate-200 mb-2">Understanding Schemas</h3>
            <p className="text-[13px] text-slate-400 leading-relaxed">
              Schemas define exactly what data is extracted. If you choose "Invoice", the AI knows to look for Line Items, Totals, and Vendors based on the defined schema.
            </p>
          </div>

        </div>
        
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-6 text-center">
          <h3 className="text-[15px] font-bold text-blue-100 mb-2">Need direct support?</h3>
          <p className="text-[13px] text-blue-300/80 mb-4">Our engineering team is ready to help you set up custom models and complex extraction pipelines.</p>
          <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-bold rounded-xl transition-all">
            Contact Support
          </button>
        </div>

      </div>
    </div>
  )
}
