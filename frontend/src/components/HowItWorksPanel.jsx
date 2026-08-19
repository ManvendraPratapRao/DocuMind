import { Upload, Cpu, CheckCircle2 } from 'lucide-react'

const STEPS = [
  { Icon: Upload,       title: 'Upload',  desc: 'Drop any PDF, PNG, or JPG document',       color: 'blue'    },
  { Icon: Cpu,          title: 'Analyze', desc: 'AI reads and understands the document',     color: 'purple'  },
  { Icon: CheckCircle2, title: 'Extract', desc: 'Structured data ready to use or export',    color: 'emerald' },
]

const DOC_TYPES = [
  { icon: '📄', label: 'Invoices'        },
  { icon: '🧾', label: 'Receipts'        },
  { icon: '👤', label: 'Resumes / CVs'   },
  { icon: '✉️', label: 'Emails'          },
  { icon: '📦', label: 'Purchase Orders' },
  { icon: '🏦', label: 'Bank Statements' },
  { icon: '🏥', label: 'Medical Bills'   },
]

export default function HowItWorksPanel() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0f1c] overflow-y-auto">
      <div className="w-full max-w-md p-8 space-y-8 animate-fade-in">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Cpu size={24} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">DocuMind AI</h2>
          <p className="text-[13px] text-slate-400 mt-1.5">Intelligent document extraction in seconds</p>
        </div>

        {/* Steps */}
        <div className="relative pl-2">
          {/* Connector line */}
          <div
            className="absolute bg-slate-800"
            style={{ left: '27px', top: '24px', bottom: '24px', width: '2px' }}
          />
          <div className="space-y-6">
            {STEPS.map(({ Icon, title, desc, color }, i) => (
              <div key={i} className="flex items-start gap-5 relative">
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10
                  ${color === 'blue'    ? 'bg-blue-500/15    border border-blue-500/25'    : ''}
                  ${color === 'purple'  ? 'bg-purple-500/15  border border-purple-500/25'  : ''}
                  ${color === 'emerald' ? 'bg-emerald-500/15 border border-emerald-500/25' : ''}
                `}>
                  <Icon size={16} className={
                    color === 'blue'    ? 'text-blue-400'    :
                    color === 'purple'  ? 'text-purple-400'  :
                                         'text-emerald-400'
                  } />
                </div>
                <div className="pt-1.5">
                  <p className="text-[14px] font-semibold text-slate-200">{title}</p>
                  <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800/80" />

        {/* Sample output */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">
            Supported Documents
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {DOC_TYPES.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/40 rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-300 transition-colors"
              >
                <span className="text-[13px]">{f.icon}</span>
                <span className="text-[11px] font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
