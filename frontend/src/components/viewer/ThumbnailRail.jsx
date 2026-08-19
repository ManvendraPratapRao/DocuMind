import React, { useRef, useEffect } from 'react';
import { Page } from 'react-pdf';

export default function ThumbnailRail({ numPages, currentPage, onPageSelect }) {
  const railRef = useRef(null);

  // Auto-scroll rail to keep active thumbnail in view
  useEffect(() => {
    if (!railRef.current) return;
    const activeThumb = railRef.current.querySelector(`[data-page-index="${currentPage}"]`);
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPage]);

  if (!numPages || numPages <= 1) return null;

  return (
    <div 
      ref={railRef}
      className="w-24 shrink-0 bg-[#0a0f1c] border-r border-slate-800/80 overflow-y-auto flex flex-col items-center py-4 gap-4"
    >
      {Array.from(new Array(numPages), (el, index) => {
        const pageNumber = index + 1;
        const isActive = pageNumber === currentPage;
        return (
          <div 
            key={`thumb_${pageNumber}`}
            data-page-index={pageNumber}
            onClick={() => onPageSelect(pageNumber)}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className={`
              p-0.5 rounded transition-all duration-200
              ${isActive ? 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.4)]' : 'bg-transparent group-hover:bg-slate-700/50'}
            `}>
              <div className="bg-white rounded-[2px] overflow-hidden shadow-sm flex items-center justify-center min-h-[96px] w-[68px]">
                <Page
                  pageNumber={pageNumber}
                  width={68}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  loading={
                    <div className="w-full h-24 bg-slate-100 flex animate-pulse" />
                  }
                />
              </div>
            </div>
            <span className={`text-[10px] font-medium ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
              {pageNumber}
            </span>
          </div>
        );
      })}
    </div>
  );
}
