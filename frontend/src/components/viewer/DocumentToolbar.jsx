import React from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Minimize, FileText, LayoutTemplate, LayoutPanelLeft } from 'lucide-react';

export default function DocumentToolbar({
  fileName,
  isPdf,
  currentPage,
  numPages,
  zoom,
  viewMode,
  isFullscreen,
  onZoomIn,
  onZoomOut,
  onZoomTo,
  onFitPage,
  onFitWidth,
  onPrevPage,
  onNextPage,
  onToggleFullscreen
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f172a] border-b border-slate-800/80 shrink-0">
      
      {/* Left: Document Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200 truncate max-w-[200px]" title={fileName || 'Document Preview'}>
            {fileName || 'Document Preview'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
            {isPdf ? 'PDF' : 'IMAGE'}
          </span>
          {numPages && (
            <span className="text-xs font-medium text-slate-500">
              {numPages} {numPages === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>
      </div>

      {/* Center: Page Navigation */}
      <div className="flex items-center gap-1.5 bg-[#151b2b] border border-slate-700/50 rounded-lg p-1">
        <button 
          onClick={onPrevPage}
          disabled={currentPage <= 1}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Previous page (Left Arrow)"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-[13px] font-medium text-slate-300 px-2 min-w-[50px] text-center">
          {currentPage} <span className="text-slate-600">/</span> {numPages || '?'}
        </div>
        <button 
          onClick={onNextPage}
          disabled={!numPages || currentPage >= numPages}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Next page (Right Arrow)"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Right: View & Zoom Controls */}
      <div className="flex items-center gap-3">
        
        {/* View Modes */}
        <div className="flex items-center gap-1 bg-[#151b2b] border border-slate-700/50 rounded-lg p-1">
          <button 
            onClick={onFitPage}
            className={`p-1.5 rounded transition-colors text-xs font-medium flex items-center gap-1.5 ${viewMode === 'fit-page' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
            title="Fit Page (0)"
          >
            <LayoutTemplate size={14} />
            <span className="hidden sm:inline">Fit Page</span>
          </button>
          <button 
            onClick={onFitWidth}
            className={`p-1.5 rounded transition-colors text-xs font-medium flex items-center gap-1.5 ${viewMode === 'fit-width' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
            title="Fit Width"
          >
            <LayoutPanelLeft size={14} />
            <span className="hidden sm:inline">Fit Width</span>
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-[#151b2b] border border-slate-700/50 rounded-lg p-1">
          <button 
            onClick={onZoomOut}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut size={14} />
          </button>
          
          <button 
            onClick={() => onZoomTo(1)}
            className="text-[12px] font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 px-2 py-1 rounded min-w-[56px] text-center transition-colors"
            title="Actual Size (1)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button 
            onClick={onZoomIn}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Fullscreen */}
        <button 
          onClick={onToggleFullscreen}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 bg-[#151b2b] border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen (F)"}
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>

      </div>
    </div>
  );
}
