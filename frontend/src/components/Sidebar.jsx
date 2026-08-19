import { useState } from 'react';
import { FileText, Plus, Trash2, CheckCircle2, XCircle, Loader2, LayoutGrid, Code, Database, Settings, CreditCard, ArrowLeft, Folder, ChevronRight, ChevronDown, FolderPlus } from 'lucide-react';

function StatusIcon({ status }) {
  if (status === 'done')     return <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />;
  if (status === 'failed')   return <XCircle      size={13} className="text-red-400 shrink-0" />;
  return <Loader2 size={13} className="text-blue-400 shrink-0 animate-spin-slow" />;
}

export default function Sidebar({ 
  jobs, 
  activeJobId, 
  onSelectJob, 
  onNewUpload, 
  onDeleteJob, 
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveJobToFolder,
  activePage = 'extractions', 
  setActivePage,
  folders = [],
  selectedJobs = [],
  setSelectedJobs,
  onBulkExportCSV,
  onBulkWebhook,
  onBulkDelete
}) {
  const [showAllExtractions, setShowAllExtractions] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Filtering logic
  let filteredJobs = jobs;
  if (filterType !== 'all') filteredJobs = filteredJobs.filter(j => j.doc_type === filterType);
  if (showAllExtractions && activeFolderId) {
    if (activeFolderId === 'unorganized') filteredJobs = filteredJobs.filter(j => !j.folder_id);
    else filteredJobs = filteredJobs.filter(j => j.folder_id === activeFolderId);
  }
  const displayedJobs = showAllExtractions ? filteredJobs : jobs.slice(0, 5);

  const toggleSelection = (e, jobId) => {
    e.stopPropagation();
    if (selectedJobs.includes(jobId)) {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    } else {
      setSelectedJobs([...selectedJobs, jobId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedJobs.length === filteredJobs.length && filteredJobs.length > 0) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(filteredJobs.map(j => j.job_id));
    }
  };

  // Get unique doc types for the filter dropdown
  const uniqueDocTypes = [...new Set(jobs.map(j => j.doc_type).filter(Boolean))];

  const navItems = [
    { id: 'templates', label: 'Templates', icon: <LayoutGrid size={15} /> },
    { id: 'schemas', label: 'Schemas', icon: <Code size={15} /> },
    { id: 'api', label: 'API & Models', icon: <Database size={15} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={15} /> },
  ]

  return (
    <aside
      className="flex flex-col h-full bg-[#0a0f1c] border-r border-slate-800/80"
      style={{ width: '264px', flexShrink: 0 }}
    >
      {/* ── Brand ── */}
      <div className="px-5 py-5 pb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0"
            style={{ boxShadow: '0 0 16px rgba(37,99,235,0.4)' }}
          >
            <FileText size={16} className="text-white" />
          </div>
          <div>
            <span className="block text-[15px] font-bold text-white tracking-tight leading-none mb-1">DocuMind AI</span>
            <span className="block text-[11px] text-slate-500 font-medium leading-none">Intelligent document extraction</span>
          </div>
        </div>
      </div>

      {/* ── New Extraction button ── */}
      <div className="px-4 pb-6 border-b border-slate-800/50">
        <button
          onClick={() => { onNewUpload(); setActivePage('extractions'); setShowAllExtractions(false); }}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-[13px] px-4 py-2.5 rounded-xl font-semibold transition-all duration-150"
          style={{ boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}
        >
          <Plus size={15} />
          New Extraction
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── History list ── */}
        <div className="px-2 pt-5 pb-2">
          <div className="flex items-center justify-between px-3 mb-2">
            {showAllExtractions ? (
              <div className="flex items-center justify-between w-full">
                <button 
                  onClick={() => { setShowAllExtractions(false); setSelectedJobs([]); }}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-widest shrink-0"
                >
                  <ArrowLeft size={12} /> Back
                </button>
                <div className="flex items-center gap-2">
                  <select 
                    value={filterType}
                    onChange={(e) => { setFilterType(e.target.value); setSelectedJobs([]); }}
                    className="bg-slate-800 text-slate-300 text-[10px] uppercase font-bold tracking-wider border-none rounded px-1 py-0.5 outline-none"
                  >
                    <option value="all">All Types</option>
                    {uniqueDocTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Recent Extractions
              </p>
            )}
          </div>
          
          {showAllExtractions && displayedJobs.length > 0 && (
            <div className="px-3 mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer hover:text-slate-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={selectedJobs.length === filteredJobs.length && filteredJobs.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
                />
                Select All
              </label>
              <span className="text-[10px] font-bold text-blue-400">{selectedJobs.length} selected</span>
            </div>
          )}
          
          {jobs.length === 0 ? (
             <div className="px-3 py-3">
               <p className="text-xs text-slate-600">No extractions yet.</p>
             </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {displayedJobs.map(job => {
                const isActive = activeJobId === job.job_id && activePage === 'extractions';
                const iconBg =
                  job.status === 'done'       ? 'bg-slate-800 text-slate-300' :
                  job.status === 'failed'     ? 'bg-red-500/10 text-red-400'     :
                                                'bg-blue-500/10 text-blue-400';

                return (
                  <div
                    key={job.job_id}
                    onClick={() => { onSelectJob(job); setActivePage('extractions') }}
                    className={`
                      group relative flex items-center justify-between px-3 py-2.5
                      rounded-xl cursor-pointer transition-all duration-150
                      ${isActive ? 'bg-blue-500/10 ring-1 ring-blue-500/20' : 'hover:bg-slate-800/40'}
                    `}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {showAllExtractions && (
                        <input 
                          type="checkbox"
                          checked={selectedJobs.includes(job.job_id)}
                          onChange={(e) => toggleSelection(e, job.job_id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0 ml-1"
                        />
                      )}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${showAllExtractions ? 'hidden sm:flex' : ''}`}>
                        <FileText size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-medium truncate leading-tight ${isActive ? 'text-blue-300' : 'text-slate-300'}`}>
                          {job.filename || 'Unknown file'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {job.status === 'done' ? 'Extracted' : job.status}
                        </p>
                      </div>
                    </div>
                    
                    <div className="shrink-0 pl-2 opacity-100 group-hover:hidden flex items-center">
                      <StatusIcon status={job.status} />
                    </div>

                    <div className="hidden group-hover:flex items-center shrink-0">
                      {/* Move to folder dropdown (only in View All) */}
                      {showAllExtractions && (
                         <select
                           onClick={e => e.stopPropagation()}
                           onChange={e => { onMoveJobToFolder(job.job_id, e.target.value || null) }}
                           value={job.folder_id || ''}
                           className="bg-slate-800 text-slate-400 text-[10px] rounded mr-2 px-1 py-1 border-none outline-none"
                         >
                           <option value="">No Folder</option>
                           {folders.map(f => (
                             <option key={f.id} value={f.id}>{f.name}</option>
                           ))}
                         </select>
                      )}

                      <button
                        onClick={e => { e.stopPropagation(); onDeleteJob(job.job_id); }}
                        className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {!showAllExtractions && jobs.length > 5 && (
            <button 
              onClick={() => setShowAllExtractions(true)}
              className="w-full text-center mt-3 py-2 text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
            >
              View All Extractions &rarr;
            </button>
          )}

          {showAllExtractions && (
            <div className="px-3 mt-4 flex flex-col gap-2">
              <button 
                onClick={onBulkExportCSV}
                disabled={selectedJobs.length === 0}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 uppercase tracking-widest transition-all"
              >
                Export CSV ({selectedJobs.length})
              </button>
              <button 
                onClick={onBulkWebhook}
                disabled={selectedJobs.length === 0}
                className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-500/30 rounded-lg text-[11px] font-bold text-blue-400 uppercase tracking-widest transition-all"
              >
                Send to Webhook
              </button>
              <button 
                onClick={onBulkDelete}
                disabled={selectedJobs.length === 0}
                className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30 rounded-lg text-[11px] font-bold text-red-400 uppercase tracking-widest transition-all mt-1"
              >
                Delete Selected
              </button>
            </div>
          )}
        </div>

        {/* ── Folders Section ── */}
        {!showAllExtractions && (
          <div className="px-2 pt-4 border-t border-slate-800/50">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Folders
              </p>
              <button 
                onClick={() => setIsCreatingFolder(true)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1"
              >
                <FolderPlus size={13} />
              </button>
            </div>
            
            <div className="flex flex-col gap-0.5">
              {isCreatingFolder && (
                <div className="px-3 py-2 flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newFolderName.trim()) {
                        onCreateFolder(newFolderName.trim());
                        setNewFolderName('');
                        setIsCreatingFolder(false);
                      } else if (e.key === 'Escape') {
                        setIsCreatingFolder(false);
                        setNewFolderName('');
                      }
                    }}
                    onBlur={() => {
                       setIsCreatingFolder(false);
                       setNewFolderName('');
                    }}
                    placeholder="Folder name..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-[12px] text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
              )}
              
              <button
                onClick={() => { setShowAllExtractions(true); setActiveFolderId('unorganized'); }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800/40 transition-colors"
              >
                <Folder size={14} className="text-slate-500" />
                Unorganized
              </button>
              
              {folders.map(f => (
                <div key={f.id} className="group flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/40 transition-colors">
                  {editingFolderId === f.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingFolderName}
                      onChange={e => setEditingFolderName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && editingFolderName.trim()) {
                          onRenameFolder(f.id, editingFolderName.trim());
                          setEditingFolderId(null);
                        } else if (e.key === 'Escape') {
                          setEditingFolderId(null);
                        }
                      }}
                      onBlur={() => setEditingFolderId(null)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-0.5 text-[12px] text-slate-200 outline-none focus:border-blue-500"
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => { setShowAllExtractions(true); setActiveFolderId(f.id); }}
                        className="flex items-center gap-3 text-[13px] font-medium text-slate-400 hover:text-slate-300 flex-1 truncate text-left"
                      >
                        <Folder size={14} className="text-blue-500/70 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </button>
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => { setEditingFolderId(f.id); setEditingFolderName(f.name); }}
                          className="p-1 rounded text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                        </button>
                        <button
                          onClick={() => { if (window.confirm("Delete this folder? Jobs inside will be moved to Unorganized.")) onDeleteFolder(f.id); }}
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Workspace ── */}
        {!showAllExtractions && (
          <div className="px-2 pt-4 pb-6 mt-2 border-t border-slate-800/50">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
              Workspace
            </p>
            <div className="flex flex-col gap-0.5">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors
                    ${activePage === item.id ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/40'}
                  `}
                >
                  <span className={`${activePage === item.id ? 'text-blue-400' : 'text-slate-500'}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Section: Usage ── */}
      {!showAllExtractions && (
        <div className="p-4 border-t border-slate-800/50 bg-[#080d17]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Extractions</span>
            <span className="text-[11px] font-bold text-blue-400">{jobs.length} / 30 stored</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((jobs.length / 30) * 100, 100)}%` }} />
          </div>
          <button className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-[12px] font-semibold transition-colors">
            <CreditCard size={14} className="text-slate-400" />
            Upgrade Plan
          </button>
        </div>
      )}

    </aside>
  );
}
