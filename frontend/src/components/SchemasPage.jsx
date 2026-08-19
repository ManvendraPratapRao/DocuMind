import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Layers, Hash, Calendar, ToggleLeft, Type, X, CheckCircle2, FileText, List } from 'lucide-react';

// ─── Built-in schemas (read-only reference) ──────────────────────────────
const BUILTIN_SCHEMAS = [
  { id: 'invoice', name: 'Invoice', description: 'Extracts line items, vendor details, totals, and tax.', fields: [
    { name: 'vendor_name', field_type: 'text' }, { name: 'invoice_number', field_type: 'text' },
    { name: 'invoice_date', field_type: 'date' }, { name: 'total_amount', field_type: 'number' },
    { name: 'line_items', field_type: 'list', description: 'description, quantity, unit_price, total' },
  ]},
  { id: 'receipt', name: 'Receipt', description: 'Merchant info, items, and total paid.', fields: [
    { name: 'merchant_name', field_type: 'text' }, { name: 'total_amount', field_type: 'number' },
    { name: 'transaction_date', field_type: 'date' }, { name: 'payment_method', field_type: 'text' },
    { name: 'items', field_type: 'list', description: 'name, price' },
  ]},
  { id: 'resume', name: 'Resume / CV', description: 'Personal info, skills, and work history.', fields: [
    { name: 'first_name', field_type: 'text' }, { name: 'last_name', field_type: 'text' },
    { name: 'email', field_type: 'text' }, { name: 'skills', field_type: 'list', description: 'skill name' },
    { name: 'experience', field_type: 'list', description: 'company, title, start_date, end_date' },
  ]},
  { id: 'email', name: 'Email', description: 'Sender, recipient, subject, and message intent.', fields: [
    { name: 'sender_email', field_type: 'text' }, { name: 'subject', field_type: 'text' },
    { name: 'body_summary', field_type: 'text' }, { name: 'action_items', field_type: 'list', description: 'action item text' },
  ]},
  { id: 'bank_statement', name: 'Bank Statement', description: 'Account info and transactions.', fields: [
    { name: 'account_holder', field_type: 'text' }, { name: 'opening_balance', field_type: 'number' },
    { name: 'closing_balance', field_type: 'number' }, { name: 'transactions', field_type: 'list', description: 'date, description, amount' },
  ]},
  { id: 'medical_bill', name: 'Medical Bill', description: 'Patient, provider, and billing details.', fields: [
    { name: 'patient_name', field_type: 'text' }, { name: 'provider_name', field_type: 'text' },
    { name: 'total_charges', field_type: 'number' }, { name: 'line_items', field_type: 'list', description: 'service, charge' },
  ]},
  { id: 'purchase_order', name: 'Purchase Order', description: 'PO details, items, and shipping.', fields: [
    { name: 'po_number', field_type: 'text' }, { name: 'vendor_name', field_type: 'text' },
    { name: 'total_amount', field_type: 'number' }, { name: 'items', field_type: 'list', description: 'description, quantity, unit_price' },
  ]},
];

const FIELD_TYPES = [
  { value: 'text',    label: 'Text',    icon: <Type size={12} />,        color: 'text-blue-400' },
  { value: 'number',  label: 'Number',  icon: <Hash size={12} />,        color: 'text-emerald-400' },
  { value: 'date',    label: 'Date',    icon: <Calendar size={12} />,    color: 'text-purple-400' },
  { value: 'boolean', label: 'Boolean', icon: <ToggleLeft size={12} />,  color: 'text-amber-400' },
  { value: 'list',    label: 'List',    icon: <List size={12} />,        color: 'text-rose-400' },
];

const SUBFIELD_TYPES = FIELD_TYPES.filter(t => t.value !== 'list');

function FieldTypeTag({ type }) {
  const def = FIELD_TYPES.find(t => t.value === type) || FIELD_TYPES[0];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 ${def.color}`}>
      {def.icon}{def.label}
    </span>
  );
}

function EmptyField() {
  return { name: '', field_type: 'text', description: '', is_required: false, list_item_schema: null, _subFields: [] };
}

function EmptySubField() {
  return { name: '', field_type: 'text', description: '' };
}

// ─── Sub-field builder for List type ──────────────────────────────────────
function SubFieldBuilder({ subFields, onChange }) {
  const update = (idx, key, val) =>
    onChange(subFields.map((sf, i) => i === idx ? { ...sf, [key]: val } : sf));
  const remove = (idx) => onChange(subFields.filter((_, i) => i !== idx));
  const add = () => onChange([...subFields, EmptySubField()]);

  return (
    <div className="mt-2 ml-4 border-l-2 border-rose-500/30 pl-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-rose-400/80 uppercase tracking-wider">List Item Fields</span>
        <button onClick={add} className="flex items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors">
          <Plus size={10} /> Add Sub-field
        </button>
      </div>
      {subFields.length === 0 && (
        <p className="text-[11px] text-slate-600 italic mb-2">No sub-fields — the list will contain plain strings. Add sub-fields to create structured objects.</p>
      )}
      {subFields.map((sf, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_90px_1fr_20px] gap-2 mb-1.5 items-center">
          <input type="text" value={sf.name} onChange={e => update(idx, 'name', e.target.value)}
            placeholder="e.g. amount"
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-rose-500/60 transition-colors" />
          <select value={sf.field_type} onChange={e => update(idx, 'field_type', e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-1 py-1.5 text-[11px] text-slate-200 outline-none focus:border-rose-500/60 transition-colors">
            {SUBFIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="text" value={sf.description} onChange={e => update(idx, 'description', e.target.value)}
            placeholder="Description hint"
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-rose-500/60 transition-colors" />
          <button onClick={() => remove(idx)}
            className="flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Schema Card (for the list view) ─────────────────────────────────────
function SchemaCard({ schema, isBuiltin = false, onDelete, expandedId, setExpandedId }) {
  const isExpanded = expandedId === schema.id;
  return (
    <div className={`border rounded-2xl overflow-hidden transition-colors ${isBuiltin ? 'bg-slate-900/30 border-slate-800/60' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isBuiltin ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-blue-500/15 border border-blue-500/20'}`}>
            {isBuiltin ? <FileText size={13} className="text-indigo-400" /> : <Layers size={13} className="text-blue-400" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-semibold text-white truncate">{schema.name}</p>
              {isBuiltin && <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">Built-in</span>}
            </div>
            {schema.description && <p className="text-[12px] text-slate-500 truncate">{schema.description}</p>}
          </div>
          <span className="shrink-0 text-[11px] font-bold text-slate-500 bg-slate-800 px-2.5 py-0.5 rounded-full ml-1">
            {schema.fields?.length || 0} fields
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-3">
          <button onClick={() => setExpandedId(isExpanded ? null : schema.id)} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {!isBuiltin && onDelete && (
            <button onClick={() => { if (window.confirm(`Delete "${schema.name}"?`)) onDelete(schema.id); }}
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-slate-800 px-5 py-4 bg-slate-950/20">
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[1fr_100px_2fr] gap-3 px-1 mb-1">
              {['Field Name', 'Type', 'Description'].map(h => (
                <span key={h} className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{h}</span>
              ))}
            </div>
            {(schema.fields || []).map((f, i) => {
              let subFields = [];
              if (f.field_type === 'list' && f.list_item_schema) {
                try { subFields = JSON.parse(f.list_item_schema); } catch {}
              }
              return (
                <div key={f.id || i}>
                  <div className="grid grid-cols-[1fr_100px_2fr] gap-3 items-center bg-slate-800/30 rounded-lg px-3 py-2">
                    <span className="text-[12px] font-mono text-slate-200">{f.name}</span>
                    <FieldTypeTag type={f.field_type} />
                    <span className="text-[12px] text-slate-500 truncate">{f.description || '—'}</span>
                  </div>
                  {f.field_type === 'list' && subFields.length > 0 && (
                    <div className="ml-4 mt-1 mb-1 border-l-2 border-rose-500/20 pl-3">
                      {subFields.map((sf, j) => (
                        <div key={j} className="grid grid-cols-[1fr_100px_2fr] gap-3 items-center py-1">
                          <span className="text-[11px] font-mono text-slate-400">↳ {sf.name}</span>
                          <FieldTypeTag type={sf.field_type || 'text'} />
                          <span className="text-[11px] text-slate-600">{sf.description || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function SchemasPage({ schemas = [], onCreateSchema, onDeleteSchema }) {
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFields, setFormFields] = useState([EmptyField()]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('custom');

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormFields([EmptyField()]); setIsCreating(false);
  };

  const updateField = (idx, key, val) =>
    setFormFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));

  const updateSubFields = (idx, subFields) => {
    const listItemSchema = subFields.length > 0 ? JSON.stringify(subFields) : null;
    setFormFields(prev => prev.map((f, i) => i === idx ? { ...f, _subFields: subFields, list_item_schema: listItemSchema } : f));
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    const validFields = formFields.filter(f => f.name.trim()).map(f => ({
      name: f.name,
      field_type: f.field_type,
      description: f.description,
      is_required: f.is_required,
      list_item_schema: f.field_type === 'list' ? f.list_item_schema : null,
    }));
    if (validFields.length === 0) return;
    setIsSaving(true);
    try {
      await onCreateSchema({ name: formName.trim(), description: formDescription.trim() || null, fields: validFields });
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0b0f1a] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight mb-1">Schemas</h1>
          <p className="text-[13px] text-slate-400">View built-in schemas or create custom extraction templates with nested fields.</p>
        </div>
        {!isCreating && activeTab === 'custom' && (
          <button onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold rounded-xl transition-all"
            style={{ boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
            <Plus size={15} /> New Schema
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900/60 border border-slate-800 rounded-xl p-1 w-fit">
        {[{id:'custom',label:'Custom Schemas'},{id:'builtin',label:'Built-in Schemas'}].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${activeTab === tab.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {isCreating && activeTab === 'custom' && (
        <div className="mb-6 bg-slate-900/60 border border-slate-700/80 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[14px] font-bold text-white">New Custom Schema</span>
            <button onClick={resetForm} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={15} /></button>
          </div>
          <div className="p-5">
            {/* Name + description */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Schema Name *</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Legal Contract"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                <input type="text" value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  placeholder="Optional — what is this schema for?"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            {/* Fields */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Extraction Fields</label>
                <button onClick={() => setFormFields(p => [...p, EmptyField()])}
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors">
                  <Plus size={12} /> Add Field
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_110px_1fr_60px_24px] gap-2 px-1">
                  {['Field Name', 'Type', 'Description (AI hint)', 'Required', ''].map(h => (
                    <span key={h} className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{h}</span>
                  ))}
                </div>

                {formFields.map((field, idx) => (
                  <div key={idx}>
                    {/* Main field row */}
                    <div className="grid grid-cols-[1fr_110px_1fr_60px_24px] gap-2 items-center">
                      <input type="text" value={field.name}
                        onChange={e => updateField(idx, 'name', e.target.value)}
                        placeholder="e.g. contract_party"
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[12px] text-slate-200 outline-none focus:border-blue-500 transition-colors" />
                      <select value={field.field_type}
                        onChange={e => updateField(idx, 'field_type', e.target.value)}
                        className={`bg-slate-800 border rounded-lg px-2 py-2 text-[12px] text-slate-200 outline-none transition-colors ${field.field_type === 'list' ? 'border-rose-500/50 focus:border-rose-500' : 'border-slate-700 focus:border-blue-500'}`}>
                        {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <input type="text" value={field.description}
                        onChange={e => updateField(idx, 'description', e.target.value)}
                        placeholder={field.field_type === 'list' ? 'e.g. line items of the document' : 'e.g. Full name of the first party'}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[12px] text-slate-200 outline-none focus:border-blue-500 transition-colors" />
                      <div className="flex justify-center">
                        <input type="checkbox" checked={field.is_required}
                          onChange={e => updateField(idx, 'is_required', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-0" />
                      </div>
                      <button onClick={() => formFields.length > 1 && setFormFields(p => p.filter((_, i) => i !== idx))}
                        disabled={formFields.length === 1}
                        className="flex items-center justify-center text-slate-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <X size={13} />
                      </button>
                    </div>

                    {/* Sub-field builder for List type */}
                    {field.field_type === 'list' && (
                      <SubFieldBuilder
                        subFields={field._subFields || []}
                        onChange={(sfs) => updateSubFields(idx, sfs)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button onClick={resetForm} className="px-4 py-2 text-[13px] font-medium text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
              <button onClick={handleSave}
                disabled={isSaving || !formName.trim() || !formFields.some(f => f.name.trim())}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded-xl transition-all">
                {isSaving ? 'Saving...' : 'Save Schema'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema Lists */}
      {activeTab === 'custom' && (
        schemas.length === 0 && !isCreating ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
              <Layers size={24} className="text-slate-600" />
            </div>
            <p className="text-[15px] font-semibold text-slate-400 mb-2">No custom schemas yet</p>
            <p className="text-[13px] text-slate-600 max-w-xs">Create a schema to extract any fields — flat or nested — from any document.</p>
            <button onClick={() => setIsCreating(true)}
              className="mt-6 flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold rounded-xl transition-all">
              <Plus size={14} /> Create your first schema
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {schemas.map(s => (
              <SchemaCard key={s.id} schema={s} expandedId={expandedId} setExpandedId={setExpandedId} onDelete={onDeleteSchema} />
            ))}
          </div>
        )
      )}

      {activeTab === 'builtin' && (
        <div className="flex flex-col gap-3">
          {BUILTIN_SCHEMAS.map(s => (
            <SchemaCard key={s.id} schema={s} isBuiltin expandedId={expandedId} setExpandedId={setExpandedId} />
          ))}
        </div>
      )}
    </div>
  );
}
