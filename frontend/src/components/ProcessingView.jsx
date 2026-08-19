import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Loader2, FileText } from 'lucide-react'

const STEPS = [
  { id: 'upload',   label: 'Document uploaded successfully', delay: 0    },
  { id: 'analyze',  label: 'Analyzing document structure',   delay: 900  },
  { id: 'extract',  label: 'Extracting fields with AI',       delay: 2000 },
  { id: 'validate', label: 'Validating extracted data',       delay: 3400 },
]

export default function ProcessingView({ filename }) {
  const [completedSteps, setCompletedSteps] = useState(new Set())
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timers = []
    STEPS.forEach((step, idx) => {
      const t = setTimeout(() => {
        setActiveStep(idx)
        if (idx > 0) {
          setCompletedSteps(prev => new Set([...prev, STEPS[idx - 1].id]))
        }
      }, step.delay)
      timers.push(t)
    })
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="flex-1 flex items-center justify-center h-full w-full bg-[#0a0f1c] animate-fade-in">
      <div className="max-w-md w-full">

        {/* File badge */}
        {filename && (
          <div className="flex items-center gap-3 mb-10 p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-200 truncate">{filename}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Queued for extraction</p>
            </div>
          </div>
        )}

        {/* Animated AI header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative w-12 h-12 shrink-0">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping-slow" />
            <div className="relative w-12 h-12 rounded-full bg-[#0a0f1c] border border-blue-500/40 flex items-center justify-center"
              style={{ boxShadow: '0 0 20px rgba(59,130,246,0.25)' }}>
              <Loader2 size={20} className="text-blue-400 animate-spin-slow" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">AI Extraction in Progress</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">This usually takes 5–15 seconds</p>
          </div>
        </div>

        {/* Step list */}
        <div className="space-y-2">
          {STEPS.map((step, idx) => {
            const done   = completedSteps.has(step.id)
            const active = idx === activeStep && !done
            const pending = idx > activeStep

            return (
              <div
                key={step.id}
                className={`
                  flex items-center gap-3.5 px-4 py-3 rounded-xl border
                  transition-all duration-500
                  ${done    ? 'bg-emerald-500/10  border-emerald-500/20' :
                    active  ? 'bg-blue-500/10    border-blue-500/25'   :
                              'bg-slate-800/30  border-slate-700/40'}
                `}
              >
                {done ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                ) : active ? (
                  <Loader2 size={16} className="text-blue-400 animate-spin-slow shrink-0" />
                ) : (
                  <Circle size={16} className="text-slate-600 shrink-0" />
                )}
                <span className={`text-[13px] font-semibold flex-1 ${
                  done    ? 'text-emerald-300' :
                  active  ? 'text-blue-300'    :
                            'text-slate-500'
                }`}>
                  {step.label}
                </span>
                {done   && <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Done</span>}
                {active && <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider animate-pulse">Running</span>}
              </div>
            )
          })}
        </div>

        {/* Subtle hint */}
        <p className="text-center text-[11px] text-slate-600 mt-6">
          Powered by Groq · Ultra-fast inference
        </p>
      </div>
    </div>
  )
}
