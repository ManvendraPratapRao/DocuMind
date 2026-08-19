import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

// ─── Collapsible section for arrays / objects ───────────────────────────────
function CollapsibleSection({ label, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full text-left mb-2 group"
      >
        {open
          ? <ChevronDown size={14} className="text-slate-500 shrink-0" />
          : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
          {label.replace(/_/g, ' ')}
        </span>
      </button>
      {open && <div className="pl-3 border-l border-slate-700/60">{children}</div>}
    </div>
  );
}

// ─── Individual editable field ───────────────────────────────────────────────
function Field({ label, value, onChange }) {
  const displayLabel = label.replace(/_/g, ' ');

  if (label === 'raw_text_preview') {
    return (
      <div className="mb-3">
        <label className="block text-[11px] font-medium text-slate-500 mb-1 uppercase tracking-wider">
          {displayLabel}
        </label>
        <textarea
          readOnly
          value={value || ''}
          rows={4}
          className="w-full bg-slate-950/60 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-500 font-mono resize-none focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="mb-3">
      <label className="block text-[11px] font-medium text-slate-500 mb-1 uppercase tracking-wider">
        {displayLabel}
      </label>
      <input
        type="text"
        value={value === null || value === undefined ? '' : String(value)}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="w-full bg-slate-900 border border-slate-700/70 rounded-md px-3 py-2 text-sm text-slate-200
                   placeholder:text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50
                   outline-none transition-all duration-150"
      />
    </div>
  );
}

// ─── Recursive node renderer ─────────────────────────────────────────────────
function JsonNode({ nodeKey, value, onUpdate }) {
  // Array
  if (Array.isArray(value)) {
    return (
      <CollapsibleSection label={nodeKey}>
        {value.length === 0
          ? <p className="text-xs text-slate-600 italic py-1">Empty list</p>
          : value.map((item, idx) => (
            <div key={idx} className="mb-3 bg-slate-800/30 rounded-lg p-3 border border-slate-700/40">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Item {idx + 1}
              </p>
              {typeof item === 'object' && item !== null
                ? Object.entries(item).map(([k, v]) => (
                    <JsonNode
                      key={k}
                      nodeKey={k}
                      value={v}
                      onUpdate={newVal => {
                        const newArr = [...value];
                        newArr[idx] = { ...newArr[idx], [k]: newVal };
                        onUpdate(newArr);
                      }}
                    />
                  ))
                : <Field
                    label={String(idx)}
                    value={item}
                    onChange={newVal => {
                      const newArr = [...value];
                      newArr[idx] = newVal;
                      onUpdate(newArr);
                    }}
                  />
              }
            </div>
          ))
        }
      </CollapsibleSection>
    );
  }

  // Nested object
  if (typeof value === 'object' && value !== null) {
    return (
      <CollapsibleSection label={nodeKey}>
        {Object.entries(value).map(([k, v]) => (
          <JsonNode
            key={k}
            nodeKey={k}
            value={v}
            onUpdate={newVal => onUpdate({ ...value, [k]: newVal })}
          />
        ))}
      </CollapsibleSection>
    );
  }

  // Primitive leaf
  return (
    <Field
      label={nodeKey}
      value={value}
      onChange={onUpdate}
    />
  );
}

// ─── Main exported component ─────────────────────────────────────────────────
const SKIP_KEYS = new Set(['status', 'confidence_score', 'warnings', 'warning']);

export default function EditableDocument({ data }) {
  const [formData, setFormData] = useState(data);

  useEffect(() => {
    setFormData(data);
  }, [data]);

  if (!formData) return null;

  const handleUpdate = (key, newValue) => {
    setFormData(prev => ({ ...prev, [key]: newValue }));
  };

  const confidence = formData.confidence_score;
  const warnings   = formData.warnings || formData.warning || [];

  const dataEntries = Object.entries(formData).filter(([k]) => !SKIP_KEYS.has(k));
  const leftEntries  = dataEntries.filter(([, v]) => !Array.isArray(v) && typeof v !== 'object');
  const rightEntries = dataEntries.filter(([, v]) =>  Array.isArray(v) || typeof v === 'object');

  return (
    <div className="animate-fade-in">
      {/* ── Confidence + Warning bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {confidence !== undefined && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
            <div className={`w-2 h-2 rounded-full ${confidence >= 0.8 ? 'bg-emerald-400' : confidence >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'}`} />
            <span className="text-xs font-medium text-slate-300">
              Confidence: {Math.round(confidence * 100)}%
            </span>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex-1 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
            <p className="text-xs text-yellow-400 truncate">
              ⚠ {warnings[0]}{warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}
            </p>
          </div>
        )}
      </div>

      {/* ── Main two-column form ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Left: flat primitive fields */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/40 p-5">
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Extracted Fields
          </h3>
          {leftEntries.length === 0
            ? <p className="text-xs text-slate-600 italic">No flat fields.</p>
            : leftEntries.map(([key, val]) => (
                <Field
                  key={key}
                  label={key}
                  value={val}
                  onChange={newVal => handleUpdate(key, newVal)}
                />
              ))
          }
        </div>

        {/* Right: nested arrays / objects */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/40 p-5">
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Nested Data
          </h3>
          {rightEntries.length === 0
            ? <p className="text-xs text-slate-600 italic">No nested data.</p>
            : rightEntries.map(([key, val]) => (
                <JsonNode
                  key={key}
                  nodeKey={key}
                  value={val}
                  onUpdate={newVal => handleUpdate(key, newVal)}
                />
              ))
          }
        </div>

      </div>
    </div>
  );
}
